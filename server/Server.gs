
/* Get DriveApp.getRootFolder(); Scope */

function doGet(){
  return HtmlService.createHtmlOutputFromFile('app/index.html').setSandboxMode(HtmlService.SandboxMode.IFRAME).setTitle("gasPacker");
}

function getLibTopLevelFunctions(libId){
  return getTopLevelFunctions(parseLibrary(rebuildLibrary(fetchLibrary(libId))));
}

function fetchLibrary(libId){
  var url  = 'https://script.google.com/feeds/download/export?id='+libId+'&format=json';
  var params = {method:"GET",contentType:"application/json",muteHttpExceptions:true,headers:{Authorization:"Bearer " + ScriptApp.getOAuthToken()}};
  var results = UrlFetchApp.fetch(url, params);
  return JSON.parse(results);
}

function rebuildLibrary(libObj,min){
  var libSource = "";
  for(var i in libObj.files){
    if(libObj.files[i].type === "server_js"){
      libSource += libObj.files[i].source + "\n";
    }     
  }
  if(min){
    libSource = minify(libSource);
  } 
  return libSource;
}

function minify(libSource){
  var ast = esprima.parse(libSource);
  var optimized = esmangle.optimize(ast, null);
  var min = esmangle.mangle(optimized)
  return escodegen.generate(min,{
    format: {
      renumber: true,
      hexadecimal: true,
      escapeless: true,
      compact: true,
      semicolons: false,
      parentheses: false
    }
  });
}

function parseLibrary(libSource){
  try{return JSON.parse(JSON.stringify(esprima.parse(libSource)));} //this isn't the best option.
  catch(e){throw new Error("Error parsing library. Is it valid JavaScript?")}
}

function getTopLevelFunctions(libObj){
  var functions = [];
  for(var i in libObj.body){    
    if(libObj.body[i].type === "VariableDeclaration"){
      for(var ii in libObj.body[i].declarations){        
        if(libObj.body[i].declarations[ii].init !== null){          
          if(libObj.body[i].declarations[ii].init.type === "FunctionExpression"){          
            functions.push(libObj.body[i].declarations[ii].id.name);
          }
        }
      }
    }else if(libObj.body[i].type === "FunctionDeclaration"){
      functions.push(libObj.body[i].id.name);
    }
  }
  //Functions with trailing _ are treated as private 
  return functions.filter(function(element){return element.charAt(element.length-1) !== "_"});
}




function saveFileToDrive(fileContent,fileName){
  var newFile = DriveApp.createFile(fileName, fileContent);
  return {name:newFile.getName(), link:"https://drive.google.com/uc?export=download&id="+newFile.getId()}
}

function buildModule(nameSpace, LibObj,minify){
  var template =  ScriptApp.getResource('server/ModuleTemplate').getDataAsString();    
  template = template.replace("<?sourceCode?>", rebuildLibrary(fetchLibrary(LibObj.libId),minify));  
  template = template.replace("<?functions?>" , LibObj.functions.map(function(element){return element+':'+element}).join(','));
  template = template.replace("<?nameSpace?>" , nameSpace);  
  return template;
}

function buildModuleFile(LibObjs,fileName,minify){
  var ModuleFile = ""  
  for(var lib in LibObjs){
    ModuleFile += buildModule(lib, LibObjs[lib],minify);
  }
  return saveFileToDrive(ModuleFile, fileName);
}



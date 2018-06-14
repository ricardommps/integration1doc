
const express = require('express');
const bodyParser = require('body-parser');
const request = require("request");
const async = require('async');
const app = express();
const logger = require('morgan');
const moment = require('moment'); 
const { Client } = require('pg');
const connectionString = 'postgres://postgres:Softcityplan2018@innovacity.cessmvb4skx1.sa-east-1.rds.amazonaws.com:5432/postgres'
var client_auth = "975EAD79";
var token = "a0d123d9u2eweklyf8dasdasdoej0j672bidkdsd";
var secret = "zcvcjk4fddfvnsh170fn47dbf45623ffdnd6hjs";

var port     = process.env.PORT || 8080; // set our port
app.use(logger('dev')); 
app.use(bodyParser.urlencoded({ extended: true }))

app.use(bodyParser.json())


app.get('/', (req, res) => {
    res.status(200).send('Innovacity Push');
});

app.get('/schedule', (req, res) => {

   // res.status(200).send(scheduledJob.secheduled());

    /* const client = new Client({
        connectionString: connectionString,
    });
    client.on('errorOn', error => {
        console.log("ERROR",errorOn)
        res.status(500).json({err:errorOn,mensage:"OPS! Algo saiu errado"});
    });
    client.connect((errconnect, client) => {
        if(errconnect) {
           console.log(">>>",errconnect)
           res.status(500).json({err:errconnect,mensage:"OPS! Algo saiu errado"});
        }
        var sql="INSERT INTO schedule(date,hour) VALUES ($1,$2)";
        const query = client.query(sql,
            [new Date(),moment(new Date()).format("HH:mm:ss")],
            function (err, result) {
            if(err || result.rowCount == 0) {
                res.status(500).json({err:err,mensage:"OPS! Algo saiu errado"});
            }else{
                res.status(200).json(result);
            }
        });
    }); */
});

app.post('/insereEmissao', (req, res) => {
    var conteudo = new Buffer(JSON.stringify(req.body.contenteFile.conteudo)).toString('base64');
    var content ={
        "method": "criarDoc",
        "emissao": {
            "grupo": "3",
			"id_documento": "4",
            "hash_pai": "0",
            "data": req.body.contenteFile.data,
            "hora": req.body.contenteFile.hora,
            "id_assunto": 266,
            "conteudo": conteudo,
            "origem_usuario_email": req.body.contenteFile.email,
            "destino_id_setor": 264,
			"id_integracao": "12345",
            "anexos":[]
        }
    }
    oneDoc(content).then(result => {
        console.log(result);
        res.status(200).json(JSON.parse(result));
      });
});

app.post('/listEmissions', (req, res) => {
    var content = {
        "method": "listEmissions",
        "emissao": {
            "grupo": "3",
			"id_documento": "4",
            "data_de": req.body.contenteFile.data_de,
            "data_ate": req.body.contenteFile.data_ate
        }
    }
    oneDoc(content).then(result => {
        console.log(result);
        res.status(200).json(JSON.parse(result));
      });
});

app.get('/allEmissions', (req, res) => {
    var emissoes = [];
    var emissionsSaveDb = [];
    var currentPage = 1,
    lastPage = 3;
    var content = {
        "method": "listEmissions",
        "emissao": {
            "grupo": "3",
			"id_documento": "4",
        },
        num_pagina:currentPage
    };
    async.whilst(function () {
        return currentPage <= lastPage;
    },
    function (next) {
        oneDoc(content).then(result => {
            var listEmissionsResJson = JSON.parse(result);
            if(listEmissionsResJson.total <= 0 || !listEmissionsResJson.emissoes){
                return;
            }
            //lastPage = listEmissionsResJson.total /30;
            listEmissionsResJson.emissoes.forEach(function(item){
                emissoes.push(item);
            });
            currentPage++;
            content.num_pagina = currentPage;
            next();
          })
    },
    function (err, n) {
        if(err){
            res.status(500).json({err:err,mensage:"OPS! Algo saiu errado"});
        }else{
            console.log('All files deleted');
            async.map(emissoes,teste, function(err,resultsMap){
                var resultConsultarDoc = resultsMap;
                async.forEach(resultConsultarDoc, function (item) {
                    if(item.numero_atendimento){
                        emissionsSaveDb.push(item)
                    }
                })
               const client = new Client({
                    connectionString: connectionString,
                });
                client.on('errorOn', error => {
                    console.log("ERROR",errorOn)
                    res.status(500).json({err:errorOn,mensage:"OPS! Algo saiu errado"});
                });
                client.connect((errconnect, client) => {
                    if(err) {
                       console.log(">>>",errconnect)
                       res.status(500).json({err:errconnect,mensage:"OPS! Algo saiu errado"});
                    }
                });
                const query = client.query(
                    buildStatement('INSERT INTO ocorrencias (endereco, position, data_abertura, origem, tipo, nome_solicitante, descricao, status_id, anexos, usuario_fiscal_id, numero_atendimento, numero_documento_solicitante, lida, hash_pai) VALUES ', emissionsSaveDb),
                    function (errorquery, result) {
                        if(errorquery || result.rowCount == 0) {
                            client.end()
                            res.status(500).json({err:errorquery,mensage:"OPS! Algo saiu errado"});
                        }else{
                            client.end()
                            res.status(200).json(result);
                        }
                    });
            })
        }
    });
});

app.post('/fileGetContent', (req, res) => {
    var conteudo = new Buffer(JSON.stringify(req.body.contenteFile.conteudo)).toString('base64');
    var content = {
        "method": "criarDoc",
        "emissao": {
            "grupo": "3",
			"id_documento": "4",
            "hash_pai": req.body.contenteFile.hash_pai,
            "data": req.body.contenteFile.data,
            "hora": req.body.contenteFile.hora,
            "conteudo": conteudo,
            "origem_usuario_email": req.body.contenteFile.email,
            "destino_id_setor": "-1",
            "id_integracao": "12345",
            "anexos":[]
        }

    }
    oneDoc(content).then(result => {
        console.log(result);
        res.status(200).json(JSON.parse(result));
      });
});

app.listen(port, () => {
    console.log("Server is listening on port"+port);
});
function buildStatement (insert, rows) {
    const params = []
    const chunks = []
    rows.forEach(row => {
      const valueClause = []
      Object.keys(row).forEach(p => {
        params.push(row[p])
        valueClause.push('$' + params.length)
      })
      chunks.push('(' + valueClause.join(', ') + ')')
    })
    return {
      text: insert + chunks.join(', '),
      values: params
    }
  }
function teste(data,callback){
    var content = {
        "method": "consultarDoc",
        "emissao": {"hash": data.hash}
    }
    oneDoc(content).then(result => {
        var jsonResult = JSON.parse(result).emissao;
            var arrayAnexos = [];
            jsonResult.anexos.forEach(function(anexos){
                arrayAnexos.push(anexos.url)
              });
            if(jsonResult.data == '0000-00-00' || !jsonResult.data){
                jsonResult.data = new Date();
            }
            var newEmission = {
                endereco: data.endereco ? data.endereco : "",
                position: (data.latitude && data.longitude) ? `${data.latitude},${data.longitude}` : null,
                data_abertura: data.data,
                origem: data.origem,
                tipo:data.assunto_txt,
                nome_solicitante:data.origem_pessoa,
                descricao:data.resumo,
                status_id:1,
                anexos: JSON.stringify(arrayAnexos),
                usuario_fiscal_id:null,
                numero_atendimento:data.num_formatado,
                numero_documento_solicitante:null,
                lida:false,
                hash_pai:data.hash
            }
        callback(null, newEmission);
      });
}
function oneDoc(content) {
    return new Promise((resolve, reject) => {
        if(content.method == 'criarDoc' || content.method == 'consultarDoc'){
            var listEmissionsData = [
                {
                    "method": content.method,
                    "client_auth": client_auth,
                    "token": token,
                    "secret": secret,
                    "emissao": content.emissao,
                }
            ]
        }else{
            var listEmissionsData = [
                {
                    "method": content.method,
                    "client_auth": client_auth,
                    "token": token,
                    "secret": secret,
                    "emissao": content.emissao,
                    "num_pagina": content.num_pagina ? content.num_pagina : 1
                }
            ]
        }
        var encoded = new Buffer(JSON.stringify(listEmissionsData)).toString('base64');
        var options = { method: 'POST',
            url: 'https://api.1doc.com.br/',
            headers:
                { 'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache',
                    'Content-Typ': 'application/x-www-form-urlencoded' },
            form: { data: encoded } };
        request(options, function (error, response, body) {
            if (error){
                console.log(">>>error:",error)
                return reject(error)
            }else{
                return resolve(body)
            }
        });
      })
}

function checkEmissions(dateFilter){
    return new Promise((resolve, reject) => {
        var emissoes = [];
        var emissionsSaveDb = [];
        var currentPage = 1,
        lastPage = 3;
        var content = {
            "method": "listEmissions",
            "emissao": {
                "grupo": "3",
                "id_documento": "4",
            },
            num_pagina:currentPage
        };
        if(dateFilter){
            content.emissao.data_de = dateFilter.data_de;
            content.emissao.data_ate = dateFilter.data_ate;
        }
        async.whilst(function () {
            return currentPage <= lastPage;
        },
        function (next) {
            oneDoc(content).then(result => {
                var listEmissionsResJson = JSON.parse(result);
                if(listEmissionsResJson.total <= 0 || !listEmissionsResJson.emissoes){
                    return reject(err)
                }
                //lastPage = listEmissionsResJson.total /30;
                listEmissionsResJson.emissoes.forEach(function(item){
                    emissoes.push(item);
                });
                currentPage++;
                content.num_pagina = currentPage;
                next();
              })
        },
        function (err, n) {
            if(err){
                return reject(err)
            }else{
                async.map(emissoes,teste, function(err,resultsMap){
                    var resultConsultarDoc = resultsMap;
                    async.forEach(resultConsultarDoc, function (item) {
                        if(item.numero_atendimento){
                            emissionsSaveDb.push(item)
                        }
                    })
                   const client = new Client({
                        connectionString: connectionString,
                    });
                    client.on('errorOn', error => {
                        console.log("ERROR",errorOn)
                        return reject(errorOn)
                    });
                    client.connect((errconnect, client) => {
                        if(err) {
                           console.log(">>>",errconnect)
                           return reject(errconnect)
                        }
                    });
                    const query = client.query(
                        buildStatement('INSERT INTO ocorrencias (endereco, position, data_abertura, origem, tipo, nome_solicitante, descricao, status_id, anexos, usuario_fiscal_id, numero_atendimento, numero_documento_solicitante, lida, hash_pai) VALUES ', emissionsSaveDb),
                        function (errorquery, result) {
                            if(errorquery || result.rowCount == 0) {
                                client.end()
                                return reject(errorquery)
                            }else{
                                //client.end()
                                sql="INSERT INTO schedule(date) VALUES ($1)"
                                client.query(sql,
                                    [new Date()], function (errInsert, resultUpdate) {
                                        if (errInsert) {
                                            return reject(errInsert)
                                        } else {
                                            return resolve(resultUpdate)
                                        }
                                    });
                            }
                        });
                })
            }
        });
    });
}

module.exports = {
    sayHelloInEnglish: function() {
      console.log("HELLO SERVER")
    },
    integration: function(){
        console.log(">>>SERVER integration")
        return new Promise((resolve, reject) => {
            const client = new Client({
                connectionString: connectionString,
            });
            client.on('errorOn', error => {
                console.log(">>ERROR CLIENT ON",errorOn)
                return reject(errorOn)
            });
            client.connect((errconnect, client) => {
                if(errconnect) {
                    console.log(">>> ERROR CONNECT",errconnect)
                    return reject(errconnect)
                }
                //var sql="INSERT INTO schedule(date,hour) VALUES ($1,$2)";
                var sql="select * from ocorrencias ORDER  BY data_abertura DESC LIMIT 1"
                const query = client.query(sql,
                    [new Date(),moment(new Date()).format("HH:mm:ss")],
                    function (err, result) {
                    if(err) {
                        console.log(">>>ERROR",err);
                        return reject(errconnect)
                    }else{
                        if(result.rowCount > 0){
                            var resultRows =  result.rows;
                            var dateFilter = {
                                data_de: moment(resultRows[0].data_abertura).format('YYYY/MM/DD'),
                                data_ate:moment(new Date()).format('YYYY/MM/DD')
                            }
                            checkEmissions(dateFilter).then(result => {
                                console.log(">>>Resolve",result)
                                return resolve(result)
                            }).catch(errCheck =>{
                                console.log(">>>errCheck",errCheck)
                                return reject(errCheck)
                            })
                        }else{
                            checkEmissions(null).then(result => {
                                console.log(">>>Resolve",result)
                                return resolve(result)
                            }).catch(errCheck =>{
                                console.log(">>>errCheck",errCheck)
                                return reject(errCheck)
                            })
                        }
                        console.log(">>>SUCCESS",result);
                    }
                });
            });
        })
    }
  };
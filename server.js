
const express = require('express');
const bodyParser = require('body-parser');
const request = require("request");
const async = require('async');
const app = express();
const logger = require('morgan');
const moment = require('moment'); 
const db = require('./db')
require('dotenv').config();

var client_auth = process.env.CLIENT_AUTH;
var token = process.env.TOKEN;
var secret = process.env.SECRET;
var port     = process.env.PORT || 8080; // set our port

app.use(logger('dev')); 
app.use(bodyParser.urlencoded({ extended: true }))

app.use(bodyParser.json())


app.get('/', (req, res) => {
    res.status(200).send('Innovacity Push');
});

app.post('/listEmissions', (req, res) => {
    console.log(">>>POST",req.body.page);
    listEmissions(req.body.page).then(result => {
        res.status(200).send(result);
    })
});



app.get('/geraOcorrencia', (req, res) => {
    geraOcorrencia().then(result => {
        res.status(200).send(result);
    })
});

app.get('/testeQuery', (req, res) => {
    var querySelect = "select * from ocorrencias ORDER  BY data_abertura DESC LIMIT 1"
   db.query(querySelect,(err,result) => {
       if(err){
           res.status(500).json(err)
       }
       if(result && result.rowCount > 0){
            var resultRows =  result.rows;
            var dateFilter = {
                data_de: moment(resultRows[0].data_abertura).format('YYYY/MM/DD'),
                data_ate:moment(new Date()).format('YYYY/MM/DD')
            }
       }
       checkEmissions(dateFilter?dateFilter:null).then(resultList => {
            res.status(200).json(resultList)
        }).catch(errCheck =>{
            res.status(500).json(errCheck)
        })
   });
});
app.listen(port, () => {
    console.log("Server is listening on port"+port);
});

function listEmissions(page){
    return new Promise((resolve, reject) => {
        var content = {
            "method": "listEmissions",
            "client_auth": client_auth,
            "token": token,
            "secret": secret,
            "emissao": {
                "grupo": "3",
                "id_documento": "4"
            },
            "num_pagina":page
        };
        var encoded = new Buffer(JSON.stringify(content)).toString('base64');
        var options = { method: 'POST',
        url: 'https://api.1doc.com.br/',
        headers:
            { 'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache' },
        form: { data: encoded } };
        console.log(">>>",options);
        request(options, function (error, response, body) {
            if (error){
                console.log(">>>error:",error)
                return reject(error)
            }else{
                var resultBody = JSON.parse(body);
                return resolve(body)
            }
        });
    })
}

function integration(){
    return new Promise((resolve, reject) => {
        var querySelect = "select * from ocorrencias ORDER  BY data_abertura DESC LIMIT 1"
        db.query(querySelect,(err,result) => {
            if(err){
                res.status(500).json(err)
            }
            if(result && result.rowCount > 0){
                 var resultRows =  result.rows;
                 var dateFilter = {
                     data_de: moment(resultRows[0].data_abertura).format('YYYY/MM/DD'),
                     data_ate:moment(new Date()).format('YYYY/MM/DD')
                 }
            }
            checkEmissions(dateFilter?dateFilter:null).then(resultList => {
                return resolve(resultList)
             }).catch(errCheck =>{
                return reject(errCheck)
             })
        });
    })
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
                    'Cache-Control': 'no-cache' },
            form: { data: encoded } };
        request(options, function (error, response, body) {
            if (error){
                console.log(">>>error:",error)
                return reject(error)
            }else{
                var resultBody = JSON.parse(body);
                return resolve(body)
            }
        });
      })
}

function findAttachments(data,callback){
    var content = {
        "method": "consultarDoc",
        "emissao": {"hash": data.hash}
    }
    oneDoc(content).then(result => {
        var arrayAnexos = [];
        if(data.data == '0000-00-00' || !data.data){
            // console.log(">>>",result.data)
            data.data = new Date();
             //console.log("<<<<",result.data)
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
            anexos:null,
            usuario_fiscal_id:null,
            numero_atendimento:data.num_formatado,
            numero_documento_solicitante:null,
            lida:false,
            hash_pai:data.hash
        };

        try{
            var jsonResult = JSON.parse(result).emissao;
            jsonResult.anexos.forEach(function(anexos){
                arrayAnexos.push(anexos.url);
              });
            if(arrayAnexos.length > 0){
               newEmission.anexos = JSON.stringify(arrayAnexos);
            } 
        }catch(err){

        }
        //console.log(">>",newEmission.data_abertura)
        callback(null, newEmission);
      });
}
function checkEmissions(dateFilter){
    return new Promise((resolve, reject) => {
        var assuntos = [18,19,20,21,22,99,23,24,30,122,32,33,72,45,47,48,49,121,50,15,17,86,92,43,42,114,144];
        var emissoes = [];
        var emissionsSaveDb = [];
        var currentPage = 1,
        lastPage = 1;
        var content = {
            "method": "listEmissions",
            "emissao": {
                "grupo": "3",
                "id_documento": "4"
            },
            num_pagina:currentPage
        };
        if(dateFilter){
            content.emissao.data_de = dateFilter.data_de;
            content.emissao.data_ate = dateFilter.data_ate;
        }
        async.whilst(function(){
            return currentPage <= lastPage;
        },function(next){
            oneDoc(content).then(result => {
                var listEmissionsResJson = JSON.parse(result);
                if(listEmissionsResJson.total <= 0 || !listEmissionsResJson.emissoes){
                    return reject("Sem emissoes")
                }
                lastPage = listEmissionsResJson.total /30;
                listEmissionsResJson.emissoes.forEach(function(item){
                    emissoes.push(item);
                });
                currentPage++;
                content.num_pagina = currentPage;
                next();
              })
        },function(err, n) {
            async.map(emissoes,findAttachments, function(err,resultsAsync) {
                var resultConsultarDoc = resultsAsync;
                async.forEach(resultConsultarDoc, function (item) {
                    if(item.numero_atendimento){
                        emissionsSaveDb.push(item)
                    }
                })
                db.query(
                    buildStatement('INSERT INTO ocorrencias (endereco, position, data_abertura, origem, tipo, nome_solicitante, descricao, status_id, anexos, usuario_fiscal_id, numero_atendimento, numero_documento_solicitante, lida, hash_pai) VALUES ', emissionsSaveDb),
                (errQuery,resultQuery) => {
                    if(errQuery){
                        return reject(errQuery)
                    }
                    if(resultQuery.rowCount > 0){
                     var querySchedule = "INSERT INTO schedule(date,hour) VALUES ($1,$2)"
                     db.query(querySchedule,
                        [new Date(),moment(new Date()).format("HH:mm:ss")],
                        (errSchedule,resultSchedule) =>{
                         if(errSchedule)  return reject(errSchedule)
                         return resolve(resultSchedule)
                     })
                    }
                });
            })
        })
    })
}

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

  function geraOcorrencia(){
    return new Promise((resolve, reject) => {
        var itens = [
            'Ocorrencia de Teste 01 - Ricardo Innovacity',
            'Ocorrencia de Teste 02 - Ricardo Innovacity',
            'Ocorrencia de Teste 03 - Ricardo Innovacity',
            'Ocorrencia de Teste 04 - Ricardo Innovacity',
            'Ocorrencia de Teste 05 - Ricardo Innovacity',
            'Ocorrencia de Teste 06 - Ricardo Innovacity',
            'Ocorrencia de Teste 07 - Ricardo Innovacity',
            'Ocorrencia de Teste 08 - Ricardo Innovacity',
            'Ocorrencia de Teste 09 - Ricardo Innovacity',
            'Ocorrencia de Teste 10 - Ricardo Innovacity',
            'Ocorrencia de Teste 11 - Ricardo Innovacity',
            'Ocorrencia de Teste 12 - Ricardo Innovacity',
            'Ocorrencia de Teste 13 - Ricardo Innovacity',
            'Ocorrencia de Teste 14 - Ricardo Innovacity',
            'Ocorrencia de Teste 15 - Ricardo Innovacity',
            'Ocorrencia de Teste 16 - Ricardo Innovacity',
            'Ocorrencia de Teste 17 - Ricardo Innovacity',
            'Ocorrencia de Teste 18 - Ricardo Innovacity',
            'Ocorrencia de Teste 19 - Ricardo Innovacity',
            'Ocorrencia de Teste 20 - Ricardo Innovacity',
            'Ocorrencia de Teste 21 - Ricardo Innovacity',
            'Ocorrencia de Teste 22 - Ricardo Innovacity',
            'Ocorrencia de Teste 23 - Ricardo Innovacity',
            'Ocorrencia de Teste 24 - Ricardo Innovacity',
            'Ocorrencia de Teste 25 - Ricardo Innovacity',
            'Ocorrencia de Teste 26 - Ricardo Innovacity',
            'Ocorrencia de Teste 27 - Ricardo Innovacity',
            'Ocorrencia de Teste 28 - Ricardo Innovacity',
            'Ocorrencia de Teste 29 - Ricardo Innovacity',
            'Ocorrencia de Teste 30 - Ricardo Innovacity',
            'Ocorrencia de Teste 31 - Ricardo Innovacity',
            'Ocorrencia de Teste 32 - Ricardo Innovacity',
            'Ocorrencia de Teste 33 - Ricardo Innovacity',
            'Ocorrencia de Teste 34 - Ricardo Innovacity',
            'Ocorrencia de Teste 35 - Ricardo Innovacity',
            'Ocorrencia de Teste 36 - Ricardo Innovacity',
            'Ocorrencia de Teste 37 - Ricardo Innovacity',
            'Ocorrencia de Teste 38 - Ricardo Innovacity',
            'Ocorrencia de Teste 39 - Ricardo Innovacity',
            'Ocorrencia de Teste 40 - Ricardo Innovacity',
            'Ocorrencia de Teste 41 - Ricardo Innovacity',
            'Ocorrencia de Teste 42 - Ricardo Innovacity',
            'Ocorrencia de Teste 43 - Ricardo Innovacity',
            'Ocorrencia de Teste 44 - Ricardo Innovacity',
            'Ocorrencia de Teste 45 - Ricardo Innovacity',
            'Ocorrencia de Teste 46 - Ricardo Innovacity',
            'Ocorrencia de Teste 47 - Ricardo Innovacity',
            'Ocorrencia de Teste 48 - Ricardo Innovacity',
            'Ocorrencia de Teste 49 - Ricardo Innovacity',
            'Ocorrencia de Teste 50 - Ricardo Innovacity',
            'Ocorrencia de Teste 51 - Ricardo Innovacity',
            'Ocorrencia de Teste 52 - Ricardo Innovacity',
            'Ocorrencia de Teste 53 - Ricardo Innovacity',
            'Ocorrencia de Teste 54 - Ricardo Innovacity',
            'Ocorrencia de Teste 55 - Ricardo Innovacity',
            'Ocorrencia de Teste 56 - Ricardo Innovacity',
            'Ocorrencia de Teste 57 - Ricardo Innovacity',
            'Ocorrencia de Teste 58 - Ricardo Innovacity',
            'Ocorrencia de Teste 59 - Ricardo Innovacity',
            'Ocorrencia de Teste 60 - Ricardo Innovacity'
        ]
        var item = itens[Math.floor(Math.random()*itens.length)];
        var conteudo = new Buffer(JSON.stringify(item)).toString('base64');
        var content ={
            "method": "criarDoc",
            "emissao": {
                "grupo": "3",
                "id_documento": "4",
                "hash_pai": "0",
                "data": new Date(),
                "hora": moment(new Date()).format("HH:mm:ss"),
                "id_assunto": 266,
                "conteudo": conteudo,
                "origem_usuario_email": 'rafael.parreira@softplan.com.br',
                "destino_id_setor": 264,
                "id_integracao": "12345",
                "anexos":[]
            }
        }
        oneDoc(content).then(result => {
            var query = "INSERT INTO schedule(date,hour) VALUES ($1,$2)"
            db.query(query,[new Date(),moment(new Date()).format("HH:mm:ss")],
            (errQuery,resultQuery) => {
                if(errQuery){
                    return reject(errQuery)
                }
                return resolve(resultQuery);
            });
          });
    })
  }

  module.exports = {
    integration,
    geraOcorrencia
  }
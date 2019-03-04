// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })
const authenticate = { realm: 'Westeros' }
const bcrypt = require('bcrypt');
fastify.register(require('fastify-basic-auth'), { validate, authenticate: { realm: 'teste' } })
fastify.register(require('fastify-cors'), { 
    allowedHeaders: ['Content-Type', 'Authorization']
 })
fastify.register(require('fastify-mysql'), {
    connectionString: 'mysql://root:password@138.68.52.165:3306/simpleads'
})

function validate(username, password, req, reply, done) {
    fastify.mysql.getConnection(onConnect)
    function onConnect(err, client) {
        if (err) return reply.send(err)
        client.query(
            'SELECT Publishers_password FROM publishers WHERE Publishers_name = ?', [username],
            function onResult(err, result) {
                client.release()
                if (result.length == 1) {
                    bcrypt.compare(password, result[0].Publishers_password, function (err, doesMatch) {
                        if (doesMatch) {
                            done()
                        } else {
                            done(new Error('Erro de autenticação'))
                        }
                    });
                }
                else {
                    done(new Error('Erro de autenticação'))
                }
            }
        )
    }
}



const mysql_fields = {
    test: (fieldsAndValues, required, callback) => {
        let errors = [];
        for (let i in required) {
            
            if (fieldsAndValues[i] == undefined) {
                let obj = {};
                obj[i] = required[i];
                errors.push(obj);
            }
        }
        callback({missing: errors});
    },
    prepareSelect: function (table, aliasesAndFields, conditions, required, callback) {

        let fieldsStr = [];
        let conditionsTratadas = [];
        let values = []; 
        let err = '';
        for (let alias in aliasesAndFields) {
            let query = aliasesAndFields[alias];
            
            let queryStr = '';
            //no alias
            if (alias == query) {
                queryStr = query;
            }
            else {
                queryStr = query + ' as ' + alias;
            }
            fieldsStr.push(queryStr);
        }
        for (let i in conditions) {
            if (conditions[i] != undefined) {
                conditionsStr = i + ' = ? ';
                values.push(conditions[i]);
                conditionsTratadas.push(conditionsStr);
            }
        }
        if (conditionsTratadas.length == 0) {
            conditionsTratadas = [ '1 = 1']
        }
        
        this.test(conditions, required, function(errors) {
            if (errors.missing.length > 0) {
                callback(errors, sql, values);
            }
            else {
                let sql = 'SELECT ' + fieldsStr.toString() + ' FROM '+ table + ' WHERE ' + conditionsTratadas.toString();
                console.log(sql);
                callback(err, sql, values);
            }
        });       

        
    },
    prepareUpdate: (table, fieldsAndValues, conditions, callback) => {

        let fieldsStr = '';
        let conditionsStr = '';
        let values = []; 
        for (let i in fieldsAndValues) {
            fieldsStr = i + ' = ? ';
            values.push(fieldsAndValues[i]);
        }
        for (let i in conditions) {
            conditionsStr = i + ' = ? ';
            values.push(conditions[i]);
        }

        let sql = 'UPDATE '+ table +' SET ' + fieldsStr + ' WHERE ' + conditionsStr;
        callback(sql, values);
    },
    testInsert: (fieldsAndValues, required, callback) => {
        let errors = [];
        for (let i in required) {
            
            if (fieldsAndValues[i] == undefined) {
                let obj = {};
                obj[i] = required[i];
                errors.push(obj);
            }
        }
        callback({missing: errors});
    },
    prepareInsert: function (table, fieldsAndValues, required, callback) {
        let fieldsStr = [];
        let matchStr = []; 
        let values = [];
        let err = '';
        let sql = '';
        for (let i in fieldsAndValues) {
            fieldsStr.push(i);
            matchStr.push('?');
            values.push(fieldsAndValues[i]);
        }
        this.testInsert(fieldsAndValues, required, function(errors) {
            if (errors.missing.length > 0) {
                callback(errors, sql, values);
            }
            else {
                sql = 'INSERT INTO '+ table +' ( ' + fieldsStr.toString() + ' ) VALUE ( ' + matchStr.toString()+ ')';
                callback(err, sql, values);
            }
        });       
    },
    gateway: function(client, json, callback) {
        switch (json.action) {
            case 'update':
                this.prepareUpdate(json.table, json.fields, json.conditions, function(sql, values) {
                    client.query(sql, values,
                        function onResult(err, result) {
                            client.release()
                            callback(err, result)
                        }
                    )            
                })
                break;
            case 'insert':
                this.prepareInsert(json.table, json.fields, json.required, function(err, sql, values) {
                    if (err.missing != undefined) return callback(err)
                    client.query(sql, values,
                        function onResult(err, result) {                            
                            client.release()
                            callback(err, result)
                        }
                    )            
                })
                break;
            case 'select':
                this.prepareSelect(json.table, json.fields, json.conditions, json.required, function(err, sql, values) {
                    if (err.missing != undefined) return callback(err)
                    client.query(sql, values,
                        function onResult(err, result) {                            
                            client.release()
                            callback(err, result)
                        }
                    )            
                })
                break;
        }
        
    }
    
}

fastify.post('/authenticate', (req, reply) => {    
    validate(req.body.username, req.body.password, req, reply, function(result) {
        console.log(result);
        if (!result) {
            console.log("autenticou");
            reply.send({ user: { firstName: req.body.username }, ok: true}); 
        }
        else {
            reply.send(result);
        }    
    });
})



// Run the server!
const start = async () => {
    try {
        await fastify.listen(3002)
        fastify.log.info(`server listening on ${fastify.server.address().port}`)
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()
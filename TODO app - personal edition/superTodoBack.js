//SuperTodo app backend 
//date started: 5/7/2024
//date completed: 1.0 - 5/29/2024
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const dbSource = "SuperTodoDB.db";
const db = new sqlite3.Database(dbSource);
const HTTP_PORT = 8000;

console.log("Listening on port " + HTTP_PORT);
var app = express();
app.use(cors());
app.use(express.json());

//creating an account class to help me with handling stuff involving the accounts in my db
class Account 
{
    constructor(username, passwordHash, email){
        this.username = username;
        this.passwordHash = passwordHash;
        this.email = email;
    }
}

//creating a task class to be used later.
class Task
{
    constructor(taskName, instruction, location, status, dueDate){
        this.taskName = taskName;
        this.instruction = instruction;
        this.location = location;
        this.status = status;
        this.dueDate = dueDate;
    }
}

//creating an endpoint  for user registration here.
app.post('/register', (req, res, next) => {
    //grabbing everything from the body
    const {username, passwordHash, email} = req.body;

    //checking if the username or password exists
    db.get('SELECT * FROM Accounts WHERE username = ? OR email = ?', [username, email], (err, row) => {
        //exception handling
        if(err){
            console.error('Database error:', err);
            res.status(500).json({error: 'Internal server error.'});
            return;
        }
        else if(row){
            //Username or email already exists\
            res.status(400).json({error: 'Username or email already in use'});
            return;
        }

        //hashing the password here
        bcrypt.hash(passwordHash, 10, (hashErr, hash) => {
            if(hashErr){
                console.error('Error hashing password:', hashErr);
                res.status(500).json({error: 'Internal server error.'})
                return;
            }

            //creating new account here
            const newAcct = new Account(username, hash, email);

            //inserting the new user into my database
            db.run('INSERT INTO Accounts (username, password_hash, email) values (?, ?, ?)', [newAcct.username, hash, newAcct.email], (insertErr) => {
                //exception handling
                if(insertErr){
                    console.error('Error inserting user:', insertErr);
                    res.status(500).json({error: 'Internal server error'});
                    return;
                }

                //User registration successful!!!
                res.status(201).json({message: 'User registered successfully!'});
            })
        })
    })
})

//creating an endpoint for my login here
//NOTE use password_hash from sqlite and look in there when using stuff from there
app.post('/login', (req, res, next) => {
    //grabbing all the necessary data from the body again
    const { username, password } = req.body;

    //retrieving the user's record from the database based on the provided username
    db.get('SELECT * FROM Accounts WHERE username = ?', [username], (err, user) => {
        if(err){
            console.error('Database error:', err);
            res.status(500).json({error: 'Internal server error.'});
            return;
        }
    
        //Log the retrieved user for debugging
        //console.log('Retrieved user:', user);
    
        //Checking if user exists
        if(!user){
            res.status(401).json({error: 'User not found'}); // User not found
            return;
        }
    
        //Compare the provided password with the hashed password from the database
        bcrypt.compare(password, user.password_hash, (bcryptErr, result) => {
            if(bcryptErr){
                console.error('Error comparing passwords:', bcryptErr);
                res.status(500).json({error: 'Internal server error'});
                return;
            }
    
            //Checking if passwords match
            if(result){
                res.status(200).json({message: 'Login successful'});
            } else {
                res.status(401).json({error: 'Invalid password'}); // Invalid password
            }
        });
    });
})

//creating an endpoint for adding a task to the database
app.post('/addTask', (req, res, next) => {
    //grabbing all necessary data from the body
    const { username, taskName, instruction, location, status, dueDate } = req.body;

    //grabbing the user ID based on the username
    db.get('SELECT account_id FROM Accounts WHERE username = ?', [username], (err, account) => {
        if(err){
            console.error('Database error:', err);
            res.status(500).json({error: 'Internal server error.'});
            return;
        }

        //Log the retrieved user for debugging
        //console.log('Retrieved user:', account);

        if(!account){
            res.status(404).json({error: 'Account not found'});
            return;
        }

        const accountId = account.account_id;

        //Inserting the task into the database
        db.run('INSERT INTO Tasks (account_id, task_name, instruction, location, status, due_date) VALUES (?, ?, ?, ?, ?, ?)', [accountId, taskName, instruction, location, status, dueDate], (insertErr) => {
            if(insertErr){
                console.error('Error inserting task:', insertErr);
                res.status(500).json({error: 'Account not found'});
                return;
            }

            //Task added successfully!
            res.status(201).json({message: 'Task added successfully!'});
        })
    })
})

//creating an endpoint to fetch all the tasks from my database by account ID
app.get('/getTasks', (req, res) => {
    const username = req.query.username; 

    //grab the account ID from the database based on the username
    db.get('SELECT account_id FROM Accounts WHERE username = ?', [username], (err, account) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ error: 'Internal server error.' });
            return;
        }

        if (!account) {
            res.status(404).json({ error: 'Account not found' });
            return;
        }

        const accountId = account.account_id;

        //grab the tasks associated with the account ID
        db.all('SELECT * FROM Tasks WHERE account_id = ?', [accountId], (err, tasks) => {
            if (err) {
                console.error('Database error:', err);
                res.status(500).json({ error: 'Internal server error.' });
            } else {
                res.json(tasks);
            }
        });
    });
});

//creating an endpoint to update the task in my database by id
app.post('/updateTask', (req, res) => {
    const { id, taskName, instruction, location, status, dueDate } = req.body;
    db.run('UPDATE Tasks SET task_name = ?, instruction = ?, location = ?, status = ?, due_date = ? WHERE task_id = ?',
        [taskName, instruction, location, status, dueDate, id],
        function (err) {
            if (err) {
                console.error('Error updating task:', err);
                res.status(500).json({ error: 'Internal server error.' });
            } else {
                res.json({ message: 'Task updated successfully!' });
            }
        });
});

//creating a delete endpoint to delete the task in my database by id
app.post('/deleteTask', (req, res) => {
    const taskId = req.body.id; //Retrieve taskId from request body
    const query = 'DELETE FROM Tasks WHERE task_id = ?';

    db.run(query, [taskId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        res.status(200).json({ message: `Task was deleted` });
    });
});

app.get('/getSettings', (req, res) => {
    const { username } = req.query;

    //Check if settings exist for the user
    db.get('SELECT * FROM Settings WHERE account_id = (SELECT account_id FROM Accounts WHERE username = ?)', [username], (err, settings) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        //If settings exist, return them
        if (settings) {
            return res.json(settings);
        } else {
            //If no settings exist, insert default settings
            const defaultSettings = {
                font_size: '16',
                font_type: 'Arial',
                bootstrap_theme: 'bootstrap.css'
            };

            //Get the account_id of the user
            db.get('SELECT account_id FROM Accounts WHERE username = ?', [username], (err, account) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Internal server error.' });
                }
                
                //Insert default settings for the user
                db.run('INSERT INTO Settings (account_id, font_size, font_type, bootstrap_theme) VALUES (?, ?, ?, ?)', [account.account_id, defaultSettings.font_size, defaultSettings.font_type, defaultSettings.bootstrap_theme], (err) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Internal server error.' });
                    }
                    
                    //Return the default settings
                    return res.json(defaultSettings);
                });
            });
        }
    });
});

//endpoint to delete the user's settings before it gets replaced in the DB
app.delete('/deleteSettings', (req, res) => {
    const { username } = req.body;

    db.get('SELECT account_id FROM Accounts WHERE username = ?', [username], (err, account) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const accountId = account.account_id;

        db.run('DELETE FROM Settings WHERE account_id = ?', [accountId], function (err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error.' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'No settings found for the account' });
            }

            return res.json({ message: 'Settings deleted successfully' });
        });
    });
});

//endpoint to save the user's settings
app.post('/saveSettings', (req, res) => {
    const { username, settings } = req.body;

    db.get('SELECT account_id FROM Accounts WHERE username = ?', [username], (err, account) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        const accountId = account.account_id;

        db.run('INSERT INTO Settings (account_id, font_size, font_type, bootstrap_theme) VALUES (?, ?, ?, ?)', 
            [accountId, settings.font_size, settings.font_type, settings.bootstrap_theme], function (err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Internal server error.' });
            }

            return res.json({ message: 'Settings saved successfully' });
        });
    });
});



app.listen(HTTP_PORT);

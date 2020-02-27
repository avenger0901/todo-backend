// Load Environment Variables from the .env file
require('dotenv').config();

// Application Dependencies
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const client = require('./lib/client');
// Initiate database connection
client.connect();

// Application Setup
const app = express();
const PORT = process.env.PORT;
app.use(morgan('dev')); // http logging
app.use(cors()); // enable CORS request
app.use(express.static('public')); // server files from /public folder
app.use(express.json()); // enable reading incoming json data
// API Routes

app.use(express.urlencoded({ extended: true }));
const createAuthRoutes = require('././lib/auth/create-auth-routes');

const authRoutes = createAuthRoutes({
    selectUser(email) {
        return client.query(`
            SELECT id, email, hash 
            FROM users
            WHERE email = $1;
        `,
        [email]
        ).then(result => result.rows[0]);
    },
    insertUser(user, hash) {
        return client.query(`
            INSERT into users (email, hash)
            VALUES ($1, $2)
            RETURNING id, email;
        `,
        [user.email, hash]
        ).then(result => result.rows[0]);
    }
});
// before ensure auth, but after other middleware:
app.use('/api/auth', authRoutes);

const ensureAuth = require('./lib/auth/ensure-auth');
app.use('/api', ensureAuth);



app.get('/api/todos', async(req, res) => {

    try {
        // make a sql query using pg.Client() to select * from todos
        const result = await client.query(`
        select * from todos where user_id=$1;
    `, [req.userId]);

        // respond to the client with that data
        res.json(result.rows);
    }
    catch (err) {
        // handle errors
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }

});
app.get('/api/todo/:todoId', async(req, res) => {
    try {
        const result = await client.query(
            `
          SELECT *
          FROM todos
          WHERE todos.id=$1`,
      // the second parameter is an array of values to be SANITIZED then inserted into the query
      // i only know this because of the `pg` docs
            [req.params.todoId]
        );

        res.json(result.rows);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// this endpoint creates a new todo
app.post('/api/todos', async(req, res) => {
    try {
        // the user input lives is req.body.task

        console.log('|||||||', req.body);
        // use req.body.task to build a sql query to add a new todo
        // we also return the new todo
        const result = await client.query(`
            insert into todos (task, complete)
            values ($1, false)

            returning *;
        `,
        [req.body.task]);

        // respond to the client request with the newly created todo
        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

// this route has a body with a complete property and an id in the params
app.put('/api/todos/:id', async(req, res) => {
    try {
        const result = await client.query(`
        update todos
        set complete=$1
        where id = $2
        returning *;
        `, [req.body.complete, req.params.id]);

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});

app.delete('/api/todos/:id', async(req, res) => {
    // get the id that was passed in the route:

    try {
        const result = await client.query(`
            delete from todos where id=${req.params.id}
            returning *;
        `,); // this array passes to the $1 in the query, sanitizing it to prevent little bobby drop tables

        res.json(result.rows[0]);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({
            error: err.message || err
        });
    }
});













app.listen(PORT, () => {
    console.log('server running on PORT', PORT);
});
require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lzi65.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const biodataCollection = client.db("soulKnotDB").collection("biodata");
        const userCollection = client.db("soulKnotDB").collection("users");
        const storiesCollection = client.db("soulKnotDB").collection("stories");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
            res.send({ token });
        })

        // middleware for jwt token vwrification
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // middleware for admin verification
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // users related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // biodata related api's
        app.get("/biodata", async (req, res) => {
            const result = await biodataCollection.find().toArray();
            res.send(result);
        });
        // Create Biodata

        app.get('/biodata/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const biodata = await biodataCollection.findOne(query);
            res.send(biodata);
        });

        // POST: Create new biodata with dynamic biodataId
        app.post('/biodata', verifyToken, async (req, res) => {
            const newBiodata = req.body;
            const lastBiodata = await biodataCollection.find().sort({ biodataId: -1 }).limit(1).toArray();

            let newBiodataId = 1;
            if (lastBiodata.length > 0) {
                newBiodataId = lastBiodata[0].biodataId + 1;
            }
            newBiodata.biodataId = newBiodataId;
            const result = await biodataCollection.insertOne(newBiodata);
            res.send(result)
        });

        app.patch('/biodata/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            delete updatedData._id;

            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: updatedData,
            };

            const result = await biodataCollection.updateOne(query, updateDoc);
            res.send(result);
        });


        // stories related api
        app.get('/stories', async (req, res) => {
            const result = await storiesCollection.find().toArray();
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Soul-Knot server is running")
})

app.listen(port, () => {
    console.log(`Soul-Knot server is running ${port}`);
})
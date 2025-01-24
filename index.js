require('dotenv').config()
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

const corsOption = {
    origin: ['http://localhost:5173', 'https://soul-knot.web.app'],
    credentials: true,
    optionalSuccessStatus: 200,
}

// middleware
app.use(cors(corsOption));
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
        // await client.connect();

        const biodataCollection = client.db("soulKnotDB").collection("biodata");
        const userCollection = client.db("soulKnotDB").collection("users");
        const favoritesCollection = client.db("soulKnotDB").collection("favorites");
        const paymentCollection = client.db("soulKnotDB").collection("payments");
        const storiesCollection = client.db("soulKnotDB").collection("stories");
        const premiumCollection = client.db("soulKnotDB").collection("premium");

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
            const { search } = req.query;
            const query = search ? { name: { $regex: search, $options: "i" } } : {};
            const result = await userCollection.find(query).toArray();
            res.send(result);
        });

        app.put('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
            const userId = req.params.id;
            const { role } = req.body;
            const userRoleUpdate = await userCollection.updateOne(
                { _id: new ObjectId(userId) },
                { $set: { role: role || 'admin' } },
                { upsert: true }
            )
            if (userRoleUpdate.modifiedCount > 0) {
                res.json({ success: true, message: 'User successfully upgraded to Admin.' });
            }
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            let premium = false;
            if (user) {
                admin = user?.role === 'admin';
                premium = user?.memberType === 'premium';
            }
            res.send({ admin, premium });
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

        app.get('/biodata/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const biodata = await biodataCollection.findOne(query);
            res.send(biodata);
        });

        // POST: Create new biodata with dynamic biodataId
        app.post('/biodata', verifyToken, async (req, res) => {
            const newBiodata = req.body;
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email });
            if (!user) {
                return res.status(404).send({ message: 'User not found' });
            }
            const lastBiodata = await biodataCollection.find().sort({ biodataId: -1 }).limit(1).toArray();
            let newBiodataId = 1;
            if (lastBiodata.length > 0) {
                newBiodataId = lastBiodata[0].biodataId + 1;
            }
            newBiodata.biodataId = newBiodataId;
            newBiodata.memberType = user.memberType;
            const result = await biodataCollection.insertOne(newBiodata);
            res.send(result)
        });

        app.patch('/biodata/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const email = req.decoded.email;
            const user = await userCollection.findOne({ email });
            if (!user) {
                return res.status(404).send({ message: 'User not found' });
            }
            delete updatedData._id;
            const query = { _id: new ObjectId(id) };
            updatedData.memberType = user.memberType;
            const updateDoc = { $set: updatedData };
            const result = await biodataCollection.updateOne(query, updateDoc);
            res.send(result);
        });

        // premium related api's
        app.post('/premium/request', verifyToken, async (req, res) => {
            const { biodataId, userEmail, userName } = req.body;
            const user = await userCollection.findOne({ email: userEmail });
            const biodata = await biodataCollection.findOne({ biodataId });
            if (!user || user.memberType === 'premium' || biodata?.memberType === 'premium') {
                return res.status(400).json({ success: false, message: 'You are already a premium member.' });
            }
            const existingRequest = await premiumCollection.findOne({ userEmail });
            if (existingRequest) {
                return res.status(400).json({ success: false, message: 'Premium request already sent.' });
            }
            const result = await premiumCollection.insertOne({
                biodataId,
                userEmail,
                userName,
                memberType: 'standard',
                status: 'pending',
            });
            res.send(result);
        })

        app.get("/premium/request", verifyToken, async (req, res) => {
            const result = await premiumCollection.find().toArray();
            res.send(result);
        });

        app.put('/approve-premium/:id', verifyToken, verifyAdmin, async (req, res) => {
            const { userEmail } = req.body;
            const userUpdate = await userCollection.updateOne(
                { email: userEmail },
                { $set: { memberType: 'premium' }, $setOnInsert: {} }
            );

            const biodataUpdate = await biodataCollection.updateOne(
                { contactEmail: userEmail },
                { $set: { memberType: 'premium' }, $setOnInsert: {} }
            );
            if (userUpdate.modifiedCount > 0 && biodataUpdate.modifiedCount > 0) {
                res.json({ success: true, message: 'User and biodata successfully upgraded to premium.' });
            }
        })

        app.put('/admin/approve-premium/:id', verifyToken, verifyAdmin, async (req, res) => {
            const { biodataId, userEmail } = req.body;

            const userUpdate = await userCollection.updateOne(
                { email: userEmail },
                { $set: { memberType: 'premium' }, $setOnInsert: {} }
            );

            const biodataUpdate = await biodataCollection.updateOne(
                { contactEmail: userEmail },
                { $set: { memberType: 'premium' }, $setOnInsert: {} }
            );
            const premiumUpdate = await premiumCollection.updateOne(
                { userEmail: userEmail },
                { $set: { memberType: 'premium', biodataId: biodataId, status: 'approved' } },
                { upsert: true }
            )

            if (userUpdate.modifiedCount > 0 && biodataUpdate.modifiedCount > 0 && premiumUpdate.modifiedCount > 0) {
                res.json({ success: true, message: 'User and biodata successfully upgraded to premium.' });
            }
        })

        // favourites related api
        app.post('/favorites', async (req, res) => {
            const { biodataId, userFavorite } = req.body;
            if (!biodataId || !userFavorite) {
                return res.status(400).json({ error: 'Missing biodataId or userFavorite' });
            }
            const existingFavorite = await favoritesCollection.findOne({ biodataId: biodataId, userFavorite: userFavorite });
            if (existingFavorite) {
                return res.status(200).json({ message: 'This biodata is already in your favorites.' });
            }
            const result = await favoritesCollection.insertOne({ biodataId, userFavorite });
            res.send(result);
        });

        app.get('/favorites/:userEmail', verifyToken, async (req, res) => {
            const { userEmail } = req.params;
            const userFavorites = await favoritesCollection.find({ userFavorite: userEmail }).toArray();
            res.send(userFavorites);
        });

        app.delete('/favorites/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await favoritesCollection.deleteOne(query);
            res.send(result);
        });

        // payment intent and payment related api's
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        app.get('/check-payment-status', verifyToken, async (req, res) => {
            const { biodataId, email } = req.query;
            const payment = await paymentCollection.findOne({ biodataId, requestEmail: email });
            if (payment) {
                res.send({ hasPaid: true, transactionId: payment.paymentId });
            } else {
                res.send({ hasPaid: false });
            }
        });

        app.post('/payments', verifyToken, async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            res.send({ paymentResult });
        })

        app.get('/payments', verifyToken, verifyAdmin, async (req, res) => {
            const requests = await paymentCollection.find().toArray();
            res.send(requests);
        });

        app.get('/my-contact-requests', verifyToken, async (req, res) => {
            const email = req.decoded.email;
            const requests = await paymentCollection.find({ requestEmail: email }).toArray();
            res.send(requests);
        });

        app.patch("/payments/:id", verifyToken, verifyAdmin, async (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            const result = await paymentCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { status } }
            );
            res.send(result);
        });

        app.delete('/delete-payment/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await paymentCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // stories related api
        app.get('/success-stories', async (req, res) => {
            const stories = await storiesCollection.find({}).sort({ createdAt: -1 }).toArray();
            res.send(stories);
        });

        app.post('/success-stories', verifyToken, async (req, res) => {
            const story = req.body;
            const result = await storiesCollection.insertOne(story);
            res.send(result);
        });

        app.patch('/success-stories/:id', verifyToken, async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    selfBiodataId: item.selfBiodataId,
                    partnerBiodataId: item.partnerBiodataId,
                    coupleImage: item.coupleImage,
                    reviewStar: item.reviewStar,
                    review: item.review,
                    marriageDate: item.marriageDate,
                }
            }
            const result = await storiesCollection.updateOne(filter, updatedDoc)
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
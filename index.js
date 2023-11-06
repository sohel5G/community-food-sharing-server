const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    // origin: ['https://car-servicing-d655d.web.app', 'https://car-servicing-d655d.firebaseapp.com'],
    origin: ['http://localhost:5173'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send('Car servicing server is running');
})

app.listen(port, () => {
    console.log(`Car servicing server is running on PORT: ${port}`);
})





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qbl5b3c.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const donnerFoodCollection = client.db("CommunityFoodSharing").collection("donatedFoods");

async function run() {
    try {
        // await client.connect();


        // add food by Donner 
        app.post('/donner/add-foods', async (req, res) => {
            const newFood = req.body;
            const result = await donnerFoodCollection.insertOne(newFood);
            res.send(result)
        })

        
        // Get Donated Foods
        app.get('/get/donated-foods', async(req, res) => {

            // Get foods by user email
            if (req.query?.userEmail){
                const query = { donator_email: req.query?.userEmail }
                const getDonatedFoodsByEmail = await donnerFoodCollection.find(query).toArray()
                return res.send(getDonatedFoodsByEmail)
            }

            // Get food by product ID 
            if (req.query.productId){
                const query = { _id: new ObjectId(req.query.productId) }
                const getDonatedFoodsByProductId = await donnerFoodCollection.findOne(query)
                return res.send(getDonatedFoodsByProductId)
            }

            // Get All foods
            const donatedFoods = await donnerFoodCollection.find().toArray()
            res.send(donatedFoods)
        })
        // Get Donated Foods End



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.log);

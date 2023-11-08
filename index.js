const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173', 'https://food-sharing-apps.web.app', 'https://food-sharing-apps.firebaseapp.com/'],
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




// Custom made middleware
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' });
        }
        req.user = decoded;
        next()
    })
}
// Custom made middleware end




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qbl5b3c.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const donnerFoodCollection = client.db("CommunityFoodSharing").collection("donatedFoods");
const requestedFoodCollection = client.db("CommunityFoodSharing").collection("RequestedFoods");



async function run() {
    try {
        // await client.connect();







        // Auth API, Create token and set it to browser cookie
        app.post('/jwt', async (req, res) => {

            const user = req.body;
            const token = jwt.sign(user, process.env.SECRET_TOKEN, { expiresIn: '1h' })

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true })
        })
        // Auth API, Create token and set it to browser cookie end


        // Remove cookie if user logout
        app.post('/logout', async (req, res) => {
            const user = req.body;

            res.clearCookie('token', { maxAge: 0, sameSite:'none',secure: true }).send({ success: true })
        })
        // Remove cookie if user logout end






        // add food by Donner 
        app.post('/donner-add-foods', async (req, res) => {
            const newFood = req.body;
            const result = await donnerFoodCollection.insertOne(newFood);
            res.send(result)
        })


        // Get Donated Foods
        try {
            app.get('/get-donated-foods', async (req, res) => {

                // Get foods by user email
                if (req.query?.userEmail) {
                    const query = { donator_email: req.query?.userEmail };
                    const getDonatedFoodsByEmail = await donnerFoodCollection.find(query).toArray();
                    return res.send(getDonatedFoodsByEmail);
                }

                // Get food by product ID 
                if (req.query.productId) {
                    const query = { _id: new ObjectId(req.query.productId) };
                    const getDonatedFoodsByProductId = await donnerFoodCollection.findOne(query);
                    return res.send(getDonatedFoodsByProductId);
                }

                // Search food name 
                if (req.query?.search) {
                    const search = req.query.search;
                    const query = { food_name: { $regex: new RegExp(search, 'i') } };
                    const result = await donnerFoodCollection.find(query).toArray();
                    return res.send(result);
                }


                // Search food by expire time
                if (req.query?.sort) {
                    const sorttext = req.query.sort;
                    const query = { expired_time: sorttext };
                    const result = await donnerFoodCollection.find(query).sort({ expired_time: 1 }).toArray();
                    return res.send(result);
                }


                // Get All foods
                const donatedFoods = await donnerFoodCollection.find().toArray()
                res.send(donatedFoods)
            })
        } catch (error) {
            console.log('Opps! ERR:', error)
        }
        // Get Donated Foods End



        // add foods by food requester
        app.post('/user-add-requested-foods', async (req, res) => {
            const requestedFood = req.body;
            const result = await requestedFoodCollection.insertOne(requestedFood);
            res.send(result)
        })



        // JWT verifyed 

        // get foods for a food requester
        app.get('/get-requested-foods', verifyToken, async (req, res) => {
            const query = { food_requester_email: req.query?.userEmail }


            if (req.user.email !== req.query?.userEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const getRequestedFoodsByEmail = await requestedFoodCollection.find(query).toArray()
            return res.send(getRequestedFoodsByEmail)

        })

        // JWT verifyed 



        // get a single food by donator food ID number
        app.get('/get-requested-food-by-donator-food-id', async (req, res) => {

            const query = { food_id: req.query.donatorFoodId };
            const getRequestedFoodByDonatorFoodId = await requestedFoodCollection.findOne(query)
            return res.send(getRequestedFoodByDonatorFoodId)

        })

        // Delete a Food from donner Food collection
        app.delete('/user-donated-food-delete', async (req, res) => {
            const donatedFoodId = req.query?.donatedFoodId;
            const query = { _id: new ObjectId(donatedFoodId) };
            const result = await donnerFoodCollection.deleteOne(query);
            res.send(result);
        })


        // Delete a Food from requested Food collection by _id
        app.delete('/user-request-delete', async (req, res) => {
            const requestedFoodId = req.query?.requestedFoodId;
            const query = { _id: new ObjectId(requestedFoodId) };
            const result = await requestedFoodCollection.deleteOne(query);
            res.send(result);
        })


        // Delete a Food from requested Food collection by food_id which add when a user request a food
        app.delete('/user-requested-food-delete', verifyToken, async (req, res) => {
            const requestedFoodId = req.query?.requestedFoodId;
            const query = { food_id: requestedFoodId };

            const result = await requestedFoodCollection.deleteOne(query);
            res.send(result);
        })


        // Edit/update donated food by user
        app.put('/donner-edit-foods/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const options = { upsert: true };

            const updatedConfirm = {
                $set: {
                    food_name: req.body.food_name,
                    food_image: req.body.food_image,
                    pickup_location: req.body.pickup_location,
                    food_quantity: req.body.food_quantity,
                    expired_time: req.body.expired_time,
                    additional_notes: req.body.additional_notes,
                    donator_image: req.body.donator_image,
                    donator_name: req.body.donator_name,
                    donator_email: req.body.donator_email,
                    food_status: req.body.food_status
                }
            };

            const result = await donnerFoodCollection.updateOne(query, updatedConfirm);
            res.send(result);

        })


        // Update Requested & Donated food Status 
        app.patch('/update-request-and-donate-food-status', async (req, res) => {
            const donatedFoodId = req.query?.donatedFoodId;
            const queryInRequestCollection = { food_id: donatedFoodId };
            const queryInDonateCollection = { _id: new ObjectId(donatedFoodId) };

            const options = { upsert: true };
            const updatedConfirm = {
                $set: {
                    food_status: req.body.food_status
                }
            };

            const requestCollectionResult = await requestedFoodCollection.updateMany(queryInRequestCollection, updatedConfirm);
            const donateCollectionResult = await donnerFoodCollection.updateOne(queryInDonateCollection, updatedConfirm, options);

            const response = {
                requestCollectionResult, donateCollectionResult
            }
            res.send(response);
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.log);

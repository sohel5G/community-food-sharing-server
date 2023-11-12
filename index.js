const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173'],
    // origin: ['http://localhost:5173', 'https://food-sharing-apps.web.app', 'https://food-sharing-apps.firebaseapp.com/', https://food-sharing-apps.netlify.app],
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

            res.clearCookie('token', {
                maxAge: 0,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true })
        })
        // Remove cookie if user logout end


        // add food by Donner 
        app.post('/donner-add-foods', verifyToken, async (req, res) => {
            const newFood = req.body;

            if (req.user.email !== req.query?.verifyUserEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const result = await donnerFoodCollection.insertOne(newFood);
            res.send(result)
        })
        // add food by Donner end






        // ------------- PUBLIC API ---------------------

        // Get Donated All Foods public API
        app.get('/get-donated-all-foods', async (req, res) => {
            try {
                const availableFoodsQuery = { food_status: { $nin: ["Delivered"] } };

                const donatedFoods = await donnerFoodCollection.find(availableFoodsQuery).toArray();
                res.send(donatedFoods);

            } catch (error) {
                console.log('Opps! ERR:', error.message);
            }
        });
        // Get Donated All Foods public API End

        // Get Donated search Foods public API
        app.get('/get-donated-search-foods', async (req, res) => {
            try {
                const availableFoodsQuery = { food_status: { $nin: ["Delivered"] } };
                const search = req.query.search;

                // availableFoodsQuery.food_name = { $regex: new RegExp(search, 'i') };
                availableFoodsQuery.food_name = { $regex: search, $options: 'i' };

                const result = await donnerFoodCollection.find(availableFoodsQuery).toArray();
                return res.send(result);

            } catch (error) {
                console.log('Opps! ERR:', error.message);
            }
        });
        // Get Donated search Foods public API End

        // Get Donated filtered Foods public API
        app.get('/get-donated-filtered-foods', async (req, res) => {
            try {
                const availableFoodsQuery = { food_status: { $nin: ["Delivered"] } };

                const filtered = req.query.filtered;
                availableFoodsQuery.expired_time = filtered;
                const result = await donnerFoodCollection.find(availableFoodsQuery).sort({ expired_time: 1 }).toArray();
                return res.send(result);

            } catch (error) {
                console.log('Opps! ERR:', error.message);
            }
        });
        // Get Donated filtered Foods public API End

        // Get Donated sorted Foods public API
        app.get('/get-donated-sorted-foods', async (req, res) => {
            try {
                const sortedText = req.query.sort;

                const availableFoodsQuery = {
                    food_status: { $nin: ["Delivered"] }
                };

                const options = {
                    sort: {
                        food_quantity: sortedText === 'asc' ? 1 : -1
                    }
                };

                const cursor = donnerFoodCollection.find(availableFoodsQuery, options)
                const result = await cursor.toArray()
                res.send(result)


            } catch (error) {
                console.log('Opps! ERR:', error.message);
            }
        });
        // Get Donated sorted Foods public API End


        // ------------- PUBLIC API ---------------------






        // Get Donated Foods for Single Food page 
        try {
            app.get('/get-donated-foods-on-single-page', verifyToken, async (req, res) => {

                const query = { _id: new ObjectId(req.query.productId) };

                if (req.user.email !== req.query.verifyUserEmail) {
                    return res.status(403).send({ message: 'forbidden access' });
                }

                const getDonatedFoodsByProductId = await donnerFoodCollection.findOne(query);
                return res.send(getDonatedFoodsByProductId);


            })
        } catch (error) {
            console.log('Opps! ERR:', error)
        }
        // Get Donated Foods for Single Food page End



        // Get Donated Foods for Manage my Food page
        try {
            app.get('/get-donated-foods-on-manage-my-food', verifyToken, async (req, res) => {

                const query = { donator_email: req.query?.userEmail };

                if (req.user.email !== req.query?.userEmail) {
                    return res.status(403).send({ message: 'forbidden access' });
                }

                const getDonatedFoodsByEmail = await donnerFoodCollection.find(query).toArray();
                return res.send(getDonatedFoodsByEmail);

            })
        } catch (error) {
            console.log('Opps! ERR:', error)
        }
        // Get Donated Foods for Manage my Food page End




        // add foods by food requester
        app.post('/user-add-requested-foods', verifyToken, async (req, res) => {
            const requestedFood = req.body;

            if (req.user.email !== req.query.verifyUserEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const result = await requestedFoodCollection.insertOne(requestedFood);
            res.send(result)
        })



        // get foods for a food requester
        app.get('/get-requested-foods', verifyToken, async (req, res) => {
            const query = { food_requester_email: req.query?.userEmail }

            if (req.user.email !== req.query?.userEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const getRequestedFoodsByEmail = await requestedFoodCollection.find(query).toArray()
            return res.send(getRequestedFoodsByEmail)

        })


        // get a requested food by donator using food ID from Requested Food Collection
        app.get('/get-a-requested-food-by-donator', verifyToken, async (req, res) => {

            const query = { food_id: req.query.donatorFoodId };

            if (req.user.email !== req.query?.verifyUserEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const getRequestedFoodByDonatorFoodId = await requestedFoodCollection.findOne(query)
            return res.send(getRequestedFoodByDonatorFoodId)

        })



        // Delete a Food from donner Food collection by _id
        app.delete('/user-donated-food-delete', verifyToken, async (req, res) => {
            const donatedFoodId = req.query?.donatedFoodId;

            if (req.user.email !== req.query?.verifyUserEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const query = { _id: new ObjectId(donatedFoodId) };
            const result = await donnerFoodCollection.deleteOne(query);
            res.send(result);
        })


        // Delete a Food from requested Food collection by _id (this API WORK food requester)
        app.delete('/user-request-delete', verifyToken, async (req, res) => {
            const requestedFoodId = req.query?.requestedFoodId;
            const query = { _id: new ObjectId(requestedFoodId) };

            if (req.user.email !== req.query?.verifyUserEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const result = await requestedFoodCollection.deleteOne(query);
            res.send(result);
        })


        // Delete a Food in requested Food collection by food_id which id add when a user request a food (This API work for donar who was donated this food)
        app.delete('/user-requested-food-delete-by-donar', verifyToken, async (req, res) => {
            const requestedFoodId = req.query?.requestedFoodId;
            const query = { food_id: requestedFoodId };

            if (req.user.email !== req.query?.verifyUserEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const result = await requestedFoodCollection.deleteOne(query);
            res.send(result);
        })






        // -------------eknjoner food onno jone edit korte pare---------------------------




        // Get Donated Food on Edit/update donated food edit input field
        try {
            app.get('/get-donated-foods-on-edit-page-input-field', verifyToken, async (req, res) => {

                const query = { _id: new ObjectId(req.query.productId) };

                if (req.user.email !== req.query.verifyUserEmail) {
                    return res.status(403).send({ message: 'forbidden access' });
                }

                const getDonatedFoodsByProductId = await donnerFoodCollection.findOne(query);
                return res.send(getDonatedFoodsByProductId);


            })
        } catch (error) {
            console.log('Opps! ERR:', error)
        }
        // Get Donated Food on Edit/update donated food edit input field end


        // Edit/update donated food by donar
        app.put('/donner-edit-foods/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            if (req.user.email !== req.query?.verifyUserEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

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
                    // food_status: req.body.food_status
                }
            };

            const result = await donnerFoodCollection.updateOne(query, updatedConfirm);
            res.send(result);

        })


        // -----------------------------------------








        // Update Requested & Donated food Status 
        app.patch('/update-request-and-donate-food-status', verifyToken, async (req, res) => {
            const donatedFoodId = req.query?.donatedFoodId;
            const queryInRequestCollection = { food_id: donatedFoodId };
            const queryInDonateCollection = { _id: new ObjectId(donatedFoodId) };

            if (req.user.email !== req.query?.verifyUserEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

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

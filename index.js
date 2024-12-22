require('dotenv').config()

const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.khjiv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Middleware
app.use(express.json());
app.use(cors());

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        // Database and Collection references
        const hotelCollection = client.db("hotel-booking").collection("rooms");
        const bookingsCollection = client.db("hotel-booking").collection("bookings");

        // Route to get all rooms
        app.get('/rooms', async (req, res) => {
            const { minPrice, maxPrice } = req.query;
            const query = {};
            if (minPrice) query.price = { $gte: parseFloat(minPrice) };
            if (maxPrice) query.price = { ...query.price, $lte: parseFloat(maxPrice) };

            try {
                const rooms = await hotelCollection.find(query).toArray();
                res.json(rooms);
            } catch (error) {
                res.status(500).send('Error fetching rooms');
            }
        });

        // Route to get room details by ID
        app.get('/rooms/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const result = await hotelCollection.findOne(query);
            res.json(result);
        });

       

    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
    }
}

run();

app.listen(port, () => {
    console.log(`Server running on port ${port}...`);
});

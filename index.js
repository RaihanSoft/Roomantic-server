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

        // ! 1. GET - Fetch all rooms

        // Route to get all rooms
        app.get('/rooms', async (req, res) => {
            try {
                const hotelCollection = client.db("hotel-booking").collection('rooms'); // Access the 'rooms' collection
                const rooms = await hotelCollection.find().toArray(); // Fetch all rooms
                res.json(rooms); // Send the rooms data as a JSON response
            } catch (error) {
                res.status(500).send('Error fetching rooms');
            }
        });





        //!  Route to get bookings for a specific u  ser by email
        app.get('/myBookings', async (req, res) => {
            const { email } = req.query;
            if (!email) {
                return res.status(400).json({ message: "Email query parameter is required." });
            }

            try {
                const bookings = await bookingsCollection.find({ userEmail: email }).toArray();
                res.status(200).json(bookings);
            } catch (error) {
                console.error("Error fetching bookings:", error);
                res.status(500).json({ message: "Error fetching bookings." });
            }
        });




        

    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
    }
}

run();

app.listen(port, () => {
    console.log(`Server running on port ${port}...`);
});

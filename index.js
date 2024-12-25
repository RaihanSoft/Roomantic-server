require('dotenv').config()

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
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
app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://mordern-hotel-booking-platform.web.app',
        'https://mordern-hotel-booking-platform.firebaseapp.com'
    ],
    credentials: true,
}));
app.use(cookieParser());

const verifyToken = (req, res, next) => {

    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'Access denied' });
    }
    //verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Invalid token' });
        }
        req.user = decoded;
        next()
    })
}


async function run() {
    try {
        // await client.connect();
        // console.log("Connected to MongoDB!");

        // Database and Collection references
        const hotelCollection = client.db("hotel-booking").collection("rooms");
        const bookingsCollection = client.db("hotel-booking").collection("bookings");



        //JWT auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '5h' })

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
            })
                .send({ success: true })
        })


        //JWT auth related api
        app.post('/logout', async (req, res) => {

            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
            })
                .send({ success: true })
        })

        // Route to get all rooms
        app.get('/rooms',  async (req, res) => {
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
        app.get('/rooms/:id',  async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) };
            const result = await hotelCollection.findOne(query);
            res.json(result);
        });



        // Route to add a new booking and mark the room as unavailable
        app.post('/book-room',  async (req, res) => {

            const booking = req.body;
            try {
                const result = await bookingsCollection.insertOne(booking);
                if (result.insertedId) {
                    await hotelCollection.updateOne(
                        { _id: new ObjectId(booking.roomId) },
                        { $set: { availability: false } }
                    );
                    res.status(201).json(result);
                } else {
                    throw new Error("Failed to book the room.");
                }
            } catch (error) {
                console.error("Error adding booking:", error);
                res.status(500).json({ message: "Error adding booking." });
            }
        });

        // Route to get bookings for a specific user by email
        app.get('/myBookings', verifyToken, async (req, res) => {
            const { email } = req.query;

            if (req.user.email !== email) {
                return res.status(403).send({ message: "Forbidden" })
            }


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

        // Route to cancel a booking by ID and mark the room as available
        app.delete('/bookings/:id',  async (req, res) => {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid ID format." });
            }

            try {
                const booking = await bookingsCollection.findOne({ _id: new ObjectId(id) });
                if (!booking) {
                    return res.status(404).json({ message: "Booking not found." });
                }
                //!here
                const bookingDate = new Date(booking.date);
                const currentDate = new Date();
                const oneDayBeforeBooking = new Date(bookingDate);
                oneDayBeforeBooking.setDate(bookingDate.getDate() - 1);

                if (currentDate > oneDayBeforeBooking) {
                    return res.status(400).json({ message: "Cannot cancel booking less than 1 day before the booked date." });
                }
                //!here
                const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 1) {
                    await hotelCollection.updateOne(
                        { _id: new ObjectId(booking.roomId) },
                        { $set: { availability: true } }
                    );
                    res.status(200).json({ message: "Booking canceled successfully." });
                } else {
                    res.status(404).json({ message: "Booking not found." });
                }
            } catch (error) {
                console.error("Error canceling booking:", error);
                res.status(500).json({ message: "Error canceling booking." });
            }
        });

        // Route to update a booking date by ID
        app.put('/bookings/:id', async (req, res) => {
            const { id } = req.params;
            const { date } = req.body;

            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid ID format." });
            }

            try {
                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { date: new Date(date).toISOString() } }
                );
                if (result.modifiedCount === 1) {
                    res.status(200).json({ message: "Booking date updated successfully." });
                } else {
                    res.status(404).json({ message: "Booking not found." });
                }
            } catch (error) {
                console.error("Error updating booking date:", error);
                res.status(500).json({ message: "Error updating booking date." });
            }
        });

        // Route to post a review for a room
        app.post('/rooms/:id/reviews', async (req, res) => {
            const { id } = req.params;
            const review = req.body;
            if (!ObjectId.isValid(id)) {
                return res.status(400).json({ message: "Invalid ID format." });
            }

            try {
                review.timestamp = new Date().toISOString(); // Add timestamp here
                const result = await hotelCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $push: { reviews: review } }
                );
                if (result.modifiedCount === 1) {
                    res.status(200).json({ message: "Review added successfully." });
                } else {
                    res.status(404).json({ message: "Room not found." });
                }
            } catch (error) {
                console.error("Error adding review:", error);
                res.status(500).json({ message: "Error adding review." });
            }
        });

        // Route to get six top-rated rooms for the Featured Rooms section
        app.get('/featured-rooms', async (req, res) => {
            try {
                const rooms = await hotelCollection.find().sort({ rating: -1 }).limit(6).toArray();
                res.json(rooms);
            } catch (error) {
                res.status(500).send('Error fetching featured rooms');
            }
        });

        // Route to get user reviews sorted by timestamp in descending order
        app.get('/reviews', async (req, res) => {
            try {
                const reviews = await hotelCollection.aggregate([
                    { $unwind: "$reviews" },
                    { $sort: { "reviews.timestamp": -1 } },
                    { $limit: 10 },
                    { $project: { _id: 0, reviews: 1 } }
                ]).toArray();
                res.json(reviews.map(review => review.reviews));
            } catch (error) {
                res.status(500).send('Error fetching reviews');
            }
        });


        



        // Route to get all hotel locations
        app.get('/hotel-locations', async (req, res) => {
            try {
                const hotelLocations = await hotelCollection.find({}, { projection: { location: 1 } }).toArray();
                res.json(hotelLocations.map(hotel => hotel.location));
            } catch (error) {
                res.status(500).send('Error fetching hotel locations');
            }
        });

    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
    }
}

run();

app.get('/', (req, res) => {
    res.send("Welcome to the Hotel Booking API!");
})

app.listen(port, () => {
    console.log(`Server running on port ${port}...`);
});

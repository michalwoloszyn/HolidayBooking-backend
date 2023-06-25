const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Place = require('./models/Place');
const Booking = require('./models/Booking');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');
//const { log } = require('console');
require('dotenv').config();

const bcryptsalt = bcrypt.genSaltSync(10);
const jwtSecret = '1231248dgdsgjbks23bbn23';

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

app.use(
  cors({
    credentials: true,
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  })
);

mongoose.connect(process.env.MONGO_URL);

app.get('/test', (req, res) => {
  //console.log('test ok');
  res.json('test ok');
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, bcryptsalt);
  try {
    const userDoc = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  console.log(userDoc);
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);

    if (passOk) {
      console.log('passOk');
      jwt.sign(
        { email: userDoc.email, id: userDoc._id },
        jwtSecret,
        {},
        (err, token) => {
          if (err) throw err;

          res
            .cookie('token', token, {
              sameSite: 'none',
              secure: true,
              domain: 'https://hoiday-booking.onrender.com',
            })
            .json(userDoc);
        }
      );
    } else {
      res.status(422).json('wrong password');
    }
  } else {
    res.json('user not found');
  }
});

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  console.log(req.cookies);
  console.log(token);
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { email, name, _id } = await User.findById(userData.id);
      res.json({ email, name, _id });
    });
  } else {
    res.json(null);
  }
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json(true);
});

app.post('/upload-by-link', async (req, res) => {
  const { link } = req.body;
  const newName = 'photo' + Date.now() + '.jpg';

  await imageDownloader
    .image({
      url: link,
      dest: __dirname + '/uploads/' + newName,
    })
    .catch((err) => console.error(err));

  res.json(newName);
});

const photosMiddleware = multer({ dest: 'uploads/' });
app.post('/upload', photosMiddleware.array('photos', 100), (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split('.');
    const extension = parts[parts.length - 1];
    const newPath = path + '.' + extension;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace('uploads\\', ''));
  }

  res.json(uploadedFiles);
});

app.post('/places', (req, res) => {
  const { token } = req.cookies;
  const {
    title,
    address,
    addedPhotos,
    perks,
    description,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id,
      title,
      address,
      photos: addedPhotos,
      perks,
      description,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
      unavailableDates: [],
    });
    res.json(placeDoc);
  });
});

app.get('/places', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.put('/places/:id', async (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhotos,
        perks,
        description,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.json('ok');
    }
  });
});

app.get('/places/:id', async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.get('/home', async (req, res) => {
  const data = req.query;
  var count = Object.keys(data).length;

  const getDatesInRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const date = new Date(start);

    const dates = [];

    while (date <= end) {
      dates.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    return dates;
  };

  if (count == 0) {
    //all places
    // console.log('all places');
    res.json(await Place.find());
  } else if (
    data.hasOwnProperty('destination') &&
    data.hasOwnProperty('startDate') &&
    data.hasOwnProperty('endDate')
  ) {
    // console.log('destination and dates');
    const alldates = getDatesInRange(data.startDate, data.endDate);
    res.json(
      await Place.find({
        address: { $regex: '.*' + data.destination + '.*', $options: 'i' },
        maxGuests: { $gte: data.guests },
        unavailableDates: { $nin: alldates },
      })
    );
  } else if (
    data.hasOwnProperty('startDate') &&
    data.hasOwnProperty('endDate')
  ) {
    //console.log('just dates');

    const alldates = getDatesInRange(data.startDate, data.endDate);
    // console.log(alldates);
    res.json(
      await Place.find({
        maxGuests: { $gte: data.guests },
        unavailableDates: { $nin: alldates },
      })
    );
  } else if (data.hasOwnProperty('destination')) {
    //console.log('just destination');

    res.json(
      await Place.find({
        address: { $regex: '.*' + data.destination + '.*', $options: 'i' },
        maxGuests: { $gte: data.guests },
      })
    );
  } else if (data.hasOwnProperty('guests')) {
    //console.log('just guests');

    res.json(
      await Place.find({
        maxGuests: { $gte: data.guests },
      })
    );
  }
});

app.post('/reserve', async (req, res) => {
  const {
    place,
    hostid,
    startDate,
    endDate,
    numberOfGuests,
    user,
    price,
    allDates,
  } = req.body;

  const placeToUpdate = await Place.findById(place._id);

  const newdates = [...placeToUpdate.unavailableDates, ...allDates];
  // console.log(place);
  placeToUpdate.set({
    unavailableDates: newdates,
  });
  await placeToUpdate.save();

  try {
    const bookingDoc = await Booking.create({
      place,
      hostid,
      startDate,
      endDate,
      numberOfGuests,
      user,
      price,
    });
    res.json(bookingDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

app.get('/bookings-host', (req, res) => {
  const { token } = req.cookies;

  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const { id } = userData;
    res.json(await Booking.find({ hostid: id }).populate('place'));
  });
});

app.get('/bookings-user', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const { id } = userData;
    res.json(await Booking.find({ user: id }).populate('place'));
  });
});

app.listen(4000, '0.0.0.0');

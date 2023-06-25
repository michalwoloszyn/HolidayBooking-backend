const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  place: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Place' },
  hostid: { type: mongoose.Schema.Types.ObjectId, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  price: { type: Number, required: true },
  numberOfGuests: { type: Number, required: true },
});

const BookingModel = mongoose.model('Booking', bookingSchema);

module.exports = BookingModel;

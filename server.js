const mongoose = require('mongoose');
require('dotenv').config();

// Sening ulanish satring (parol bilan)
const dbURI = "mongodb+srv://mingodbuchun_db_user:hJ5FSZaFLMz6uEuc@cluster0.5dqhrf9.mongodb.net/halat_biznes?retryWrites=true&w=majority";

mongoose.connect(dbURI)
  .then(() => {
    console.log("✅ MongoDB bazasiga muvaffaqiyatli ulandi!");
  })
  .catch((err) => {
    console.error("❌ Ulanishda xatolik yuz berdi:", err);
  });

// Mahsulotlar uchun namunaviy model (Schema)
const ProductSchema = new mongoose.Schema({
    nomi: String,
    miqdori: Number,
    narxi: Number,
    sana: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', ProductSchema);
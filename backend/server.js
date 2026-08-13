const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const promptRoutes = require('./routes/promptRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const statsRoutes = require('./routes/statsRoutes');

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/prompts', promptRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/stats', statsRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Backend Server running on port ${PORT}`));

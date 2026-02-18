import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Shop from './src/models/shop.model.js';
import { ShopFollow } from './src/models/shopFollow.model.js';

dotenv.config();

const syncFollowers = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to MongoDB');

        const shops = await Shop.find({});
        console.log(`Syncing ${shops.length} shops...`);

        for (const shop of shops) {
            const followerCount = await ShopFollow.countDocuments({ shop: shop._id });
            await Shop.findByIdAndUpdate(shop._id, { 'stats.totalFollowers': followerCount });
            console.log(`Synced shop: ${shop.name} (${followerCount} followers)`);
        }

        console.log('Follower sync complete');
        process.exit(0);
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
};

syncFollowers();

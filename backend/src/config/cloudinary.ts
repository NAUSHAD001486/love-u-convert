import cloudinary from 'cloudinary';
import { env } from './env';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export { cloudinary };
export default cloudinary.v2;

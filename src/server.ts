import app from "./app";
// import env from "./config/env";
import logger from "./config/logger";

// connectDB();


process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

app.listen(process.env.PORT || 3010, () => {
  logger.info(`Server running on port ${process.env.PORT}`);
});

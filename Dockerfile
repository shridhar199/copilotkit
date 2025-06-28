# Stage 1: Build the application
FROM node:22-alpine AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install **all** dependencies, including devDependencies
RUN npm install 

# Copy the entire application source code
COPY . .

# Compile TypeScript to JavaScript
RUN npx tsc
# OR if you have a build script in package.json
# RUN npm run build

# Stage 2: Create the production image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy only necessary files from the build stage
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Expose the port the app runs on
EXPOSE 3010

# Define environment variables
ENV NODE_ENV=production
ENV PORT=3010

# Start the application
CMD ["node", "dist/server.js"]
require("dotenv").config();
const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const Property = require("./models/Property");
const Counter = require("./models/Counter");

// Configuration
const n = parseInt(process.argv[2]) || 10; // Number of properties to insert

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not defined in .env");
  process.exit(1);
}

const getNextSequence = async (name) => {
  const ret = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return ret.seq;
};

const generateProperty = async () => {
  const seq = await getNextSequence("propertyId");
  const types = ["Bungalow", "Apartment", "Villa", "House", "Plot"];
  const furnishedTypes = ["Furnished", "Unfurnished", "Semi"];
  const listedByTypes = ["Builder", "Owner", "Agent"];
  const listingTypes = ["rent", "sale"];

  return {
    _id: `PROP${seq}`,
    title: faker.commerce.productName() + " " + faker.helpers.arrayElement(["Residency", "Apartments", "Villas", "Heights"]),
    type: faker.helpers.arrayElement(types),
    price: faker.number.int({ min: 1000000, max: 50000000 }),
    state: faker.location.state(),
    city: faker.location.city(),
    areaSqFt: faker.number.int({ min: 500, max: 5000 }),
    bedrooms: faker.number.int({ min: 1, max: 5 }),
    bathrooms: faker.number.int({ min: 1, max: 4 }),
    amenities: faker.helpers
      .arrayElements(
        ["Pool", "Gym", "Parking", "Security", "Garden", "Elevator", "Power Backup"],
        { min: 2, max: 5 },
      )
      .join("|"),
    furnished: faker.helpers.arrayElement(furnishedTypes),
    availableFrom: faker.date.future(),
    listedBy: faker.helpers.arrayElement(listedByTypes),
    tags: faker.helpers
      .arrayElements(
        ["Luxury", "Budget", "Family", "Quiet", "Modern", "Pet Friendly", "Sea View"],
        { min: 1, max: 3 },
      )
      .join("|"),
    colorTheme: faker.color.rgb(),
    rating: parseFloat(faker.number.float({ min: 1, max: 5, fractionDigits: 1 })),
    isVerified: faker.datatype.boolean(),
    listingType: faker.helpers.arrayElement(listingTypes),
  };
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    console.log(`Generating and inserting ${n} properties...`);
    
    // We generate them one by one to ensure unique sequence IDs from the counter
    const properties = [];
    for (let i = 0; i < n; i++) {
      const property = await generateProperty();
      properties.push(property);
    }

    await Property.insertMany(properties);
    console.log(`Successfully inserted ${n} properties.`);

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seed();

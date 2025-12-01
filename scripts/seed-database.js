const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const { connectDB } = require("../config/database")
const User = require("../models/User")
const LostItem = require("../models/LostItem")
const FoundItem = require("../models/FoundItem")

const seedDatabase = async () => {
  try {
    await connectDB()

    // Clear existing data
    await User.deleteMany({})
    await LostItem.deleteMany({})
    await FoundItem.deleteMany({})

    console.log("Cleared existing data")

    // Create admin user
    const adminPassword = await bcrypt.hash("admin123", 12)
    const admin = new User({
      name: "System Administrator",
      email: "admin@university.edu",
      password: adminPassword,
      role: "admin",
      studentId: "ADMIN001",
      phone: "+1234567890",
    })
    await admin.save()

    // Create staff user
    const staffPassword = await bcrypt.hash("staff123", 12)
    const staff = new User({
      name: "Security Staff",
      email: "staff@university.edu",
      password: staffPassword,
      role: "staff",
      studentId: "STAFF001",
      phone: "+1234567891",
    })
    await staff.save()

    // Create regular users
    const userPassword = await bcrypt.hash("user123", 12)
    const users = []

    for (let i = 1; i <= 5; i++) {
      const user = new User({
        name: `Student ${i}`,
        email: `student${i}@university.edu`,
        password: userPassword,
        role: "user",
        studentId: `STU${String(i).padStart(3, "0")}`,
        phone: `+123456789${i}`,
      })
      users.push(user)
      await user.save()
    }

    console.log("Created users")

    // Create sample lost items
    const lostItems = [
      {
        title: "iPhone 14 Pro",
        description: "Black iPhone 14 Pro with a clear case",
        category: "Electronics",
        location: "Library - 2nd Floor",
        dateLost: new Date("2024-01-15"),
        reportedBy: users[0]._id,
        contactInfo: {
          email: users[0].email,
          phone: users[0].phone,
        },
        color: "Black",
        brand: "Apple",
        additionalDetails: "Has a small scratch on the back",
      },
      {
        title: "Blue Backpack",
        description: "Navy blue Jansport backpack with laptop compartment",
        category: "Accessories",
        location: "Student Center",
        dateLost: new Date("2024-01-20"),
        reportedBy: users[1]._id,
        contactInfo: {
          email: users[1].email,
          phone: users[1].phone,
        },
        color: "Blue",
        brand: "Jansport",
        size: "Medium",
      },
      {
        title: "Calculus Textbook",
        description: "Calculus: Early Transcendentals by Stewart",
        category: "Books",
        location: "Mathematics Building",
        dateLost: new Date("2024-01-18"),
        reportedBy: users[2]._id,
        contactInfo: {
          email: users[2].email,
          phone: users[2].phone,
        },
        additionalDetails: "Has my name written inside the cover",
      },
    ]

    for (const itemData of lostItems) {
      const item = new LostItem(itemData)
      await item.save()
    }

    console.log("Created sample lost items")

    // Create sample found items
    const foundItems = [
      {
        title: "Silver Watch",
        description: "Silver digital watch with black strap",
        category: "Accessories",
        location: "Gym - Locker Room",
        dateFound: new Date("2024-01-22"),
        foundBy: staff._id,
        color: "Silver",
        storageLocation: "Security Office - Drawer A",
      },
      {
        title: "Red Water Bottle",
        description: "Stainless steel water bottle with university logo",
        category: "Other",
        location: "Cafeteria",
        dateFound: new Date("2024-01-21"),
        foundBy: staff._id,
        color: "Red",
        storageLocation: "Security Office - Shelf B",
      },
    ]

    for (const itemData of foundItems) {
      const item = new FoundItem(itemData)
      await item.save()
    }

    console.log("Created sample found items")

    console.log("Database seeded successfully!")
    console.log("\nDefault login credentials:")
    console.log("Admin: admin@university.edu / admin123")
    console.log("Staff: staff@university.edu / staff123")
    console.log("User: student1@university.edu / user123")

    process.exit(0)
  } catch (error) {
    console.error("Error seeding database:", error)
    process.exit(1)
  }
}

seedDatabase()

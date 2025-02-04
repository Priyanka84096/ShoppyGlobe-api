
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const app = new express();

app.listen(5001, () => {
    console.log("Server is running on port 5001");
});

app.use(express.json());
app.use(bodyParser.json());

//-----monogodb connection
mongoose.connect("mongodb://localhost:27017");

const db = mongoose.connection;

db.on("open", () => {
    console.log("Connection successful");
});
db.on("error", () => {
    console.log("Connection not successful");
});

//----middleware to log requests

app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});


// -------define mongoose schemas
const productSchema = new mongoose.Schema({
    name:{
    type: String,
    required: true,  
    },
    price:{
    type: Number,
    required: true,  
    },
    description:{
    type: String,
    required: true 
    },
    stock_quantity:{ 
    type: Number, 
    required: true, 
    },
},);

const cartItemSchema = new mongoose.Schema({
    product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    required: true
    },
    quantity: {
    type: Number, 
    required: true, 
   
    },
    user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
    } 
},);

const userSchema = new mongoose.Schema({
    username: { 
    type: String, 
    required: true, 
    unique: true },
    password: { 
    type: String, 
    required: true },
},);



// ------create Mongoose models
const Product = mongoose.model('Product', productSchema);
const CartItem = mongoose.model('CartItem', cartItemSchema);
const User = mongoose.model('User', userSchema);

//-----------created new product--------------
const newProduct = new Product({
    name: "Luminous Glow Foundation",
    price: 1200,
    description: "Highlights key features like lightweight texture, buildable coverage, dewy finish, hydration benefits, and shade range to appeal to a broad audience.",
    stock_quantity: 60,
});
newProduct.save().then((data) =>{
    console.log(data); 
});

// add a new product to mongoDB
app.post("/product", async (req, res) => {
    try {
        const newProduct = new Product(req.body); // Create a new Product object from req.body
        const savedProduct = await newProduct.save(); // save the data into mongodb
        res.send(savedProduct); //  Created, return the new Product
    } catch (error) {
        console.log("error message: ", error);
        res.status(500).json({ error: "Failed to add new Product" }); // If any error, return error message
    }
});
// middleware for authentication
function authenticateToken(req, res, next){
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

    jwt.verify(token, "secretkey", (err, user) => {
        if (err) return res.status(403).json({ message: "Unauthorized: Invalid token" });
        req.user = user;
        next();
    });
};

// get /products - Fetch a list of products
app.get("/products", async (req, res) => {
    try {
        const products = await Product.find();
        res.send(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// get /products/:id - Fetch details of a single product by ID
app.get("/products/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.send(product);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// post /cart - add a product to the shopping cart
app.post("/cart", authenticateToken, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        if (!productId || !quantity) {
            return res.status(400).json({ error: "Missing productId or quantity"});
        }
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        const newCartItem = new CartItem({ product: productId, quantity, user: req.user.userId });
        const cartItem = await newCartItem.save();
        res.send(cartItem);
    } catch (error) {
      console.log(error);
        res.status(500).json({ error: 'Failed to add product to cart' });
    }
});

//  put /cart/:id - update the quantity of a product in the cart
app.put("/cart/:id", authenticateToken, async (req, res) => {
    try {
        const { quantity } = req.body;
        const updatedCartItem = await CartItem.findByIdAndUpdate(req.params.id, { quantity }, { new: true });
        if (!updatedCartItem) {
            return res.status(404).json({ error: "Cart item not found" });
        }
        res.send(updatedCartItem);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update cart item' });
    }
});

// delete /cart/:id - remove a product from the cart
app.delete("/cart/:id", authenticateToken, async (req, res) => {
    try {
      const deletedCartItem = await CartItem.findByIdAndDelete(req.params.id);
        if(!deletedCartItem) {
            return res.status(404).json({ error: "Cart item not found" });
        }
        res.status(200).json({ message: 'Product removed from cart' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove product from cart' });
    }
});

// --- authentication routes ---
// post /register - Register a new user
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Missing username or password" });
        }
        const hashedPassword = await bcrypt.hash(password, 10); 
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.send({ message: 'User registered successfully' });
    } catch (error) {
      console.error(error);
         if (error.code === 11000) {
              res.status(400).json({ error: 'Username already exists'});
        }else {
         res.status(500).json({ error: 'Failed to register user' });
        }

    }
});

// post /login - authenticate user and return a JWT token
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Missing username or password" });
        }
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
         const passwordMatch = await bcrypt.compare(password, user.password); // Compare password
         if(!passwordMatch){
            return res.status(401).json({ message: "Invalid username or password"});
        }

        const token = jwt.sign({ userId: user._id, username: user.username }, 'secretkey');

        res.send({ token });
    } catch (error) {
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
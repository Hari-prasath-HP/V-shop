const Cart = require('../models/Cart');
const Product = require('../models/product');

// Add product to the cart
exports.addToCart = async (req, res) => {
    try {
      console.log('Session user:', req.session.user); // Check if user is in session
  
      // Ensure that user is authenticated and exists in the session
      if (!req.session.user) {
        return res.redirect('/login')
      }
  
      const { productId, quantity } = req.body;
      const userId = req.session.user.id; // Access user ID from session
  
      // Check if the product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
  
      // Find the existing cart item for this user and product
      const existingCartItem = await Cart.findOne({ userId, productId });
  
      if (existingCartItem) {
        // If product already in cart, update the quantity
        existingCartItem.quantity += parseInt(quantity);
        await existingCartItem.save();
        return res.redirect('/cart');
      } else {
        // If product not in cart, create a new cart entry
        const newCartItem = new Cart({
          userId,
          productId,
          quantity: parseInt(quantity),
        });
        await newCartItem.save();
        return res.redirect('/cart');
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Server error' });
    }
  };
 exports.viewCart = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    const userId = req.session.user.id;
    const cartItems = await Cart.find({ userId }).populate('productId');
    if (!cartItems || cartItems.length === 0) {
      return res.render('user/cart', { cart: [], username: req.session.user.username });
    }

    const cart = cartItems.map(item => {
      if (!item.productId) {
        return null; // Or handle the error appropriately
      }

      return {
        _id: item._id,
        productId: item.productId._id,
        name: item.productId.name,
        description: item.productId.description,
        price: item.productId.price,
        image: item.productId.images[0],
        quantity: item.quantity,
        subtotal: item.quantity * item.productId.price,
      };
    }).filter(item => item !== null);
    res.render('user/cart', { cart, username: req.session.user.username });
  } catch (err) {
    console.error('Error viewing cart:', err);
    res.status(500).send('Server Error');
  }
};
exports.updateQuantity = async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { cartItemId, quantity } = req.body;
    try {
        let cartItem = await Cart.findOne({ userId: req.session.user.id, productId: cartItemId });
        if (!cartItem) {
            console.log("Cart item not found");
            return res.status(404).json({ success: false, message: "Cart item not found" });
        }
        let product = await Product.findById(cartItem.productId);
        if (!product) {
            console.log("Product not found");
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        if (quantity > 0) {
          if (quantity > cartItem.quantity && quantity > product.stock) {
              return res.status(400).json({ success: false, message: "Invalid quantity" });
          }
          cartItem.quantity = quantity;
          await cartItem.save();
          return res.json({
              success: true,
              updatedQuantity: cartItem.quantity,
              updatedSubTotal: (cartItem.quantity * product.price).toFixed(2),
          });
      } else {
          return res.status(400).json({ success: false, message: "Invalid quantity" });
      }
    } catch (err) {
        console.error("Error updating cart quantity:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
// Remove product from the cart
exports.removeFromCart = async (req, res) => {
    try {
      console.log('Session user:', req.session.user);
      if (!req.session.user) {
        return res.redirect('/login')
      }
      const userId = req.session.user.id;
      const productId = req.params.productId;
      const result = await Cart.findOneAndDelete({ userId, productId });
      if (!result) {
        return res.status(404).json({ error: 'Product not found in cart' });
      }
      return res.redirect('/cart'); 
    } catch (error) {
      console.error('Error removing product from cart:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  };


const Cart = require('../models/Cart');
const Product = require('../models/product');
const User = require('../models/User');
const Address = require('../models/address');
const Order = require('../models/order')
exports.addToCart = async (req, res) => {
    try {
      console.log('Session user:', req.session.user);
      if (!req.session.user) {
        return res.redirect('/login')
      }
      const { productId, quantity } = req.body;
      const userId = req.session.user.id;
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const existingCartItem = await Cart.findOne({ userId, productId });
      if (existingCartItem) {
        existingCartItem.quantity += parseInt(quantity);
        await existingCartItem.save();
        return res.redirect('/cart');
      } else {
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
    const user = req.session.user;
    if (!user) {
      return res.redirect('/login'); // Redirect to login if not authenticated
  }
    const userId = req.session.user.id;
    const cartItems = await Cart.find({ userId }).populate('productId');
    if (!cartItems || cartItems.length === 0) {
      return res.render('user/cart', { cart: [], username: req.session.user.username });
    }
    const cart = cartItems.map(item => {
      if (!item.productId) {
        return null; 
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
    res.render('user/cart', { cart, username: req.session.user.username,user });
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
  exports.getCheckoutPage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const userId = req.session.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Fetch the default address
        const defaultAddress = await Address.findOne({ userId: userId, isDefault: true }) || null;

        // Check if the user has a pending order with a selected address
        const order = await Order.findOne({ user: userId, orderStatus: 'Pending' });

        // Determine the address to display
        const checkoutAddress = order?.shippingAddress || defaultAddress;

        res.render('user/checkout1', { user, checkoutAddress });
    } catch (error) {
        console.error('Error fetching checkout page:', error);
        res.status(500).send('Internal Server Error');
    }
};
exports.changeaddress = async (req, res) => {
  try {
      if (!req.session.user) {
          return res.redirect('/login');
      }

      const userId = req.session.user.id;
      const user = await User.findById(userId);
      
      if (!user) {
          return res.status(404).send('User not found');
      }

      // Fetch all addresses of the user
      const addresses = await Address.find({ userId: userId });

      res.render('user/changeaddress', { user, addresses });
  } catch (error) {
      console.error('Error fetching checkout page:', error);
      res.status(500).send('Internal Server Error');
  }
};
exports.selectAddress = async (req, res) => {
  try {
    const { selectedAddress } = req.body;
    const userId = req.session.user.id;
    if (!selectedAddress) {
        console.log("No address selected");
        return res.redirect('/address');
    }

    // Fetch the full address from the database
    const address = await Address.findById(selectedAddress);

    if (!address) {
        console.log("Address not found in DB");
        return res.redirect('/address');
    }

    console.log("Fetched Address:", address);

    // Ensure totalAmount and paymentMethod are properly passed
    const totalAmount = req.body.totalAmount || 0;  // Get from frontend or cart logic
    const paymentMethod = req.body.paymentMethod || 'COD'; // Default to Cash on Delivery

    // Create and save the new order
    const newOrder = new Order({
        user: req.session.user.id,
        shippingAddress: {
          userId: userId, // Store user reference
          name: address.name,  // Name from Address model
          phone: address.phone,
          houseNo: address.houseNo,
          area: address.area,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          title: address.title,
        },
        paymentMethod: paymentMethod,
        totalAmount: totalAmount,
    });

    await newOrder.save();
    console.log("Order saved successfully!");
    res.redirect('/checkout-1');

} catch (error) {
    console.error('Error saving selected address:', error);
    res.redirect('/address');
}
};
exports.getCheckoutPage2 = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(userId);
    const defaultAddress = await Address.findOne({ userId: userId, isDefault: true }) || null;
    const checkoutAddress = order?.shippingAddress || defaultAddress;
    // Retrieve the latest order for the user to get the selected address
    const lastOrder = await Order.findOne({ user: userId })
      .sort({ createdAt: -1 }) // Get the latest order
      .select('shippingAddress');

    res.render('user/checkout-2', { user,checkoutAddress});

  } catch (error) {
    console.error("Error fetching selected address from order:", error);
    res.status(500).send("Internal Server Error");
  }
};






const Cart = require('../models/Cart');
const Product = require('../models/product');
const User = require('../models/User');
const Address = require('../models/address');
const Order = require('../models/order');
const product = require('../models/product');
exports.addToCart = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    
    const { productId, quantity } = req.body;
    const userId = req.session.user.id;
    
    // Find the product by ID
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const requestedQuantity = parseInt(quantity, 10);

    // Check if enough stock is available
    if (product.stock < requestedQuantity) {
      req.session.errorMessage = "Insufficient stock available!";
      return res.redirect(`/product/${productId}`);  // Redirect to product details page
    }
    const existingCartItem = await Cart.findOne({ userId, productId });
    
    if (existingCartItem) {
      // Update the existing cart item with the new quantity
      existingCartItem.quantity = parseInt(quantity);
      await existingCartItem.save();
      return res.redirect('/cart');
    } else {
      // Create a new cart item
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
      const user = await User.findById(userId);  // Fetch user details
  
      if (!user) {
        return res.redirect('/login'); // Redirect if user is not found
      }
  
      const cartItems = await Cart.find({ userId: userId }).populate('productId');
      if (!cartItems || cartItems.length === 0) {
        return res.render('user/cart', { cart: [], user }); // Ensure user is passed
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
          offerPrice: item.productId.offerPrice,
          image: item.productId.images[0],
          quantity: item.quantity,
          subtotal: item.quantity * item.productId.offerPrice,
        };
      }).filter(item => item !== null);
  
      res.render('user/cart', { cart, user });
  
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
              return res.status(400).json({ success: false, message: "Stock limit reached" });
          }
          cartItem.quantity = quantity;
          await cartItem.save();
          return res.json({
              success: true,
              updatedQuantity: cartItem.quantity,
              updatedSubTotal: (cartItem.quantity * product.offerPrice).toFixed(2),
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

        // Check if the user's cart has items
        const cartItems = await Cart.find({ userId });
        if (!cartItems || cartItems.length === 0) {
            return res.redirect('/cart'); // Redirect to cart page if empty
        }

        // Fetch default address or use order's shipping address
        const defaultAddress = await Address.findOne({ userId: userId, isDefault: true }) || null;
        const order = await Order.findOne({ user: userId, orderStatus: 'Pending' });
        const checkoutAddress = order?.shippingAddress || defaultAddress;

        res.render('user/checkout1', { user, userId, checkoutAddress });
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
      return res.redirect('/address');
    }
    const address = await Address.findById(selectedAddress);
    if (!address) {
      console.log("Address not found in DB");
      return res.redirect('/address');
    }
    const totalAmount = req.body.totalAmount || 0;
    const paymentMethod = req.body.paymentMethod || 'COD';
    let existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' })
  .sort({ createdAt: -1 });
    if (existingOrder) {
      existingOrder.shippingAddress = {
        userId: userId, 
        name: address.name,
        phone: address.phone,
        houseNo: address.houseNo,
        area: address.area,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        title: address.title,
      };
      existingOrder.paymentMethod = paymentMethod;
      existingOrder.totalAmount = totalAmount;
      await existingOrder.save();
    } else {
      const newOrder = new Order({
        user: userId,
        shippingAddress: {
          userId: userId,
          name: address.name,
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
        status: 'Pending',
      });
      await newOrder.save();
    }
    res.redirect('/checkout-1');
  } catch (error) {
    console.error('Error updating selected address:', error);
    res.redirect('/address');
  }
};
exports.proceedToPayment = async (req, res) => {
  try {
      const userId = req.session.user.id;
      if (!userId) {
          return res.redirect('/login'); // Redirect if user is not logged in
      }
      const user = await User.findById(userId).lean();
      if (!user) {
          return res.redirect('/checkoutaddress'); // Redirect if user is not found
      }
      const totalAmount = req.body.totalAmount || 0;
    const paymentMethod = req.body.paymentMethod || 'COD';
      // Check if an existing order is present
      let existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' })

      if (!existingOrder) {
          let shippingAddress = user.checkoutAddress;

          // If no checkoutAddress is found, fetch the default address from the addresses schema
          if (!shippingAddress) {
            const defaultAddress = await Address.findOne({ userId, isDefault: true });
            if (defaultAddress) {
                shippingAddress = defaultAddress;
            }
        }
          // If no address is found, redirect to the address selection page
          if (!shippingAddress) {
              return res.redirect('/checkoutaddress');
          }

          // Create a new order using the selected shipping address
          existingOrder = new Order({
              user: userId,
              shippingAddress: {
                userId:userId,
                name: shippingAddress.name,
                phone: shippingAddress.phone,
                houseNo: shippingAddress.houseNo,
                area: shippingAddress.area,
                city: shippingAddress.city,
                state: shippingAddress.state,
                pincode: shippingAddress.pincode,
                title:shippingAddress.title,
              },
              paymentMethod: paymentMethod,
              totalAmount: totalAmount,
              status: "Pending"
          });

          await existingOrder.save();
      }

      res.redirect('/checkout-2'); // Proceed to payment page

  } catch (error) {
      console.error("Error proceeding to payment:", error);
      res.status(500).send("Internal Server Error");
  }
};
exports.getCheckoutPage2 = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
      return res.redirect('/login');
    }
    const user = await User.findById(userId);
    const lastOrder = await Order.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select('shippingAddress');
    const defaultAddress = await Address.findOne({ userId: userId, isDefault: true }) || null;
    const checkoutAddress = lastOrder ? lastOrder.shippingAddress : defaultAddress;
    res.render('user/checkout-2', { user, checkoutAddress });
  } catch (error) {
    console.error("Error fetching selected address from order:", error);
    res.redirect('/login');
  }
};
exports.savePaymentMethod = async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const userId = req.session.user.id;
    
    if (!paymentMethod) {
      return res.redirect('/checkout-1');
    }
    
    let existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' })
      .sort({ createdAt: -1 });
    
    if (!existingOrder) {
      console.log("No pending order found for user");
      return res.redirect('/cart');
    }
    
    existingOrder.paymentMethod = paymentMethod;
    await existingOrder.save();
    
    res.redirect('/ordersummary');
  } catch (error) {
    res.redirect('/checkout-1');
  }
};
exports.getOrderSummary = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = req.session.user.id;

    // Fetch the cart items for the user
    const cartItems = await Cart.find({ userId }).populate('productId'); // Populating product details
    if (!cartItems || cartItems.length === 0) {
      return res.redirect('/cart'); 
    }

    // Fetch the most recent order details
    const orderDetails = await Order.findOne({ 'shippingAddress.userId': userId }).sort({ createdAt: -1 });
    if (!orderDetails) {
      return res.redirect('/checkout-1');
    }

    const { shippingAddress, paymentMethod  } = orderDetails;

    // Prepare data to send to the order summary page, including cart items and shipping address
    const orderSummaryData = {
      cartItems,
      shippingAddress,
      shippingCost: 40.00,
      paymentMethod,
    };

    // Render the order summary page and pass the data
    res.render('user/ordersummary', { user, orderSummaryData });
  } catch (error) {
    res.redirect('/login')
  }
};
exports.placeOrder = async (req, res) => {
  try {
    const { products, paymentMethod, grandTotal } = req.body;
    const userId = req.session.user.id;
    console.log(req.body)
    const user = await User.findById(userId);
    if (!user) return res.redirect('/login');

    // Convert products object into an array
    const productEntries = Object.values(products);

    // Validate products
    for (const product of productEntries) {
      if (!product.offerPrice || !product.quantity) {
        return res.status(400).json({ message: "Price and quantity are required for each product." });
      }
      product.offerPrice = parseFloat(product.offerPrice);
      product.price = parseFloat(product.price);  
      product.quantity = parseInt(product.quantity, 10);  

      if (isNaN(product.price) || isNaN(product.quantity)) {
        return res.status(400).json({ message: "Invalid price or quantity." });
      }
    }

    // Get last shipping address
    const lastOrder = await Order.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select('shippingAddress');
    const defaultAddress = await Address.findOne({ userId: userId, isDefault: true }) || null;
    const checkoutAddress = lastOrder ? lastOrder.shippingAddress : defaultAddress;

    // Find existing pending order
    const existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' });
    if (!existingOrder) {
      return res.status(404).json({ message: 'No pending order found for the user.' });
    }

    // Add new products to the order
    existingOrder.products.push(
      ...productEntries.map(product => ({
        product: product.productId, // ✅ Reference to Product model
        quantity: product.quantity,
        price: product.price,
        offerPrice: product.offerPrice || 0,
        status: 'Ordered'
      }))
    );
    existingOrder.totalAmount = grandTotal;
    existingOrder.paymentMethod = paymentMethod;
    existingOrder.shippingAddress = checkoutAddress;
    existingOrder.paymentStatus = paymentMethod === 'COD' ? 'Pending' : 'Completed';

    // Save the updated order
    await existingOrder.save();

    
    // Confirm order
    await Order.findByIdAndUpdate(existingOrder._id, { orderStatus: 'Confirmed' });
    // Reduce stock for ordered products
    for (const item of productEntries) {
      const quantity = Number(item.quantity);
      console.log(quantity);
      console.log(item.productId)
      if (isNaN(quantity)) {
          console.log('Error: Invalid quantity');
      } else {
          // Proceed with reducing the stock
          await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stock: -quantity } },
              { new: true }
          );
          // Optionally, you can log the updated product
  const updatedProduct = await Product.findById(item.productId);
  console.log('Updated Product:', updatedProduct);
      }
    }
    // Clear the cart from the database
    await Cart.deleteMany({ userId });
    // Clear session cart if necessary
    req.session.cart = {};
    await req.session.save();

    const order = await Order.findOne({ user: userId }).sort({ createdAt: -1 });
    return res.render('user/success', {
      orderId: order._id,
      user: user || null,
    });

  } catch (error) {
    console.error('Error placing order:', error);
    return res.redirect('/login')
  }
};
exports.cancelProduct = async (req, res) => {
  try {
      const { orderId, productId, reason } = req.body;
      const order = await Order.findById(orderId);

      if (!order) {
          return res.status(404).json({ message: "Order not found" });
      }

      const productIndex = order.products.findIndex(p => p.product.toString() === productId);
      if (productIndex === -1) {
          return res.status(404).json({ message: "Product not found in order" });
      }

      if (order.products[productIndex].status !== 'Ordered') {
          return res.status(400).json({ message: "Product cannot be canceled" });
      }

      order.products[productIndex].status = 'Canceled';
      order.products[productIndex].cancellationReason = reason;
      await order.save();

      res.json({ message: "Product canceled successfully." });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
  }
};

exports.returnProduct = async (req, res) => {
  try {
      const { orderId, productId, reason } = req.body;
      const order = await Order.findById(orderId);

      if (!order) {
          return res.status(404).json({ message: "Order not found" });
      }

      const productIndex = order.products.findIndex(p => p.product.toString() === productId);
      if (productIndex === -1) {
          return res.status(404).json({ message: "Product not found in order" });
      }

      if (order.products[productIndex].status !== 'Delivered') {
          return res.status(400).json({ message: "Product cannot be returned" });
      }

      order.products[productIndex].status = 'Returned';
      order.products[productIndex].returnReason = reason;
      await order.save();

      res.json({ message: "Product returned successfully." });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
  }
};


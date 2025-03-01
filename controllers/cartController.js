const Cart = require('../models/Cart');
const Product = require('../models/product');
const User = require('../models/User');
const Address = require('../models/address');
const Order = require('../models/order');
const product = require('../models/product');
const Coupon = require('../models/coupon');
require('dotenv').config();
const Razorpay = require('razorpay');
const crypto = require("crypto");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,  // Remove quotes
  key_secret: process.env.RAZORPAY_SECRET  // Remove quotes
});
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
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const userId = req.session.user.id;
    const productId = req.params.productId;

    // Find and delete the cart document matching the user and product
    const result = await Cart.findOneAndDelete({ userId, productId });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Product not found in cart' });
    }

    return res.json({ success: true, message: 'Product removed from cart' });
  } catch (error) {
    console.error('Error removing product from cart:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
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

      // Fetch an existing pending order or fallback to default address
      let order = await Order.findOne({ user: userId, orderStatus: 'Pending' }).sort({ createdAt: -1 });
      let checkoutAddress = order?.shippingAddress || (await Address.findOne({ userId: userId, isDefault: true }));

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

      const addresses = await Address.find({ userId });
      res.render('user/changeaddress', { user, addresses });
  } catch (error) {
      console.error('Error fetching change address page:', error);
      res.status(500).send('Internal Server Error');
  }
};

exports.selectAddress = async (req, res) => {
  try {
      if (!req.session.user) {
          return res.redirect('/login');
      }

      const { selectedAddress, totalAmount = 0, paymentMethod = 'COD' } = req.body;
      const userId = req.session.user.id;

      if (!selectedAddress) {
          req.flash('error', 'Please select an address.');
          return res.redirect('/changeaddress');
      }

      const address = await Address.findById(selectedAddress);
      if (!address) {
          req.flash('error', 'Selected address not found.');
          return res.redirect('/changeaddress');
      }

      let existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' }).sort({ createdAt: -1 });

      const shippingAddress = {
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

      if (existingOrder) {
          existingOrder.shippingAddress = shippingAddress;
          existingOrder.paymentMethod = paymentMethod;
          existingOrder.totalAmount = totalAmount;
          await existingOrder.save();
      } else {
            existingOrder = new Order({
              user: userId,
              shippingAddress,
              paymentMethod,
              totalAmount,
              orderStatus: 'Pending',
          });
          await existingOrder.save();
      }

      res.redirect('/checkout-1');
  } catch (error) {
      console.error('Error updating selected address:', error);
      res.status(500).send('Internal Server Error');
  }
};
exports.proceedToPayment = async (req, res) => {
  try {
      const userId = req.session.user.id;
      const paymentMethod = req.body.paymentMethod || 'COD';
      if (!userId) {
          return res.redirect('/login'); // Redirect if user is not logged in
      }
      const user = await User.findById(userId).lean();
      if (!user) {
          return res.redirect('/checkoutaddress'); // Redirect if user is not found
      }
      const totalAmount = req.body.totalAmount || 0;;
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
    
    // Fetch cart items
    const cartItems = await Cart.find({ userId }).populate('productId');
    if (!cartItems || cartItems.length === 0) {
      return res.redirect('/cart'); 
    }

    // Fetch the latest order details
    const orderDetails = await Order.findOne({ 'shippingAddress.userId': userId }).sort({ createdAt: -1 });
    if (!orderDetails) {
      return res.redirect('/checkout-1');
    }

    // Fetch valid coupons
    const currentDate = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      isDeleted: false,
      expiryDate: { $gte: currentDate } // Ensures the coupon is not expired
    });
    const { shippingAddress, paymentMethod } = orderDetails;

    // Order Summary Data
    const orderSummaryData = {
      cartItems,
      shippingAddress,
      paymentMethod,
      coupons // Pass available coupons to the view
    };
    const appliedCoupon = req.session.appliedCoupon || null; // Retrieve from session or logic
    const discount = req.session.discount || 0;
    res.render('user/ordersummary', { user, orderSummaryData,discount,appliedCoupon});
  } catch (error) {
    console.error(error);
    res.redirect('/login');
  }
};
exports.applyCoupon = async (req, res) => {
  try {
      const { couponCode, grandTotal } = req.body;

      if (!couponCode) {
          return res.status(400).json({ success: false, message: "Coupon code is required." });
      }

      const coupon = await Coupon.findOne({ code: couponCode, isActive: true, isDeleted: false });

      if (!coupon) {
          return res.status(400).json({ success: false, message: "Invalid or expired coupon." });
      }

      // Check if the coupon has expired
      if (new Date() > coupon.expiryDate) {
          return res.status(400).json({ success: false, message: "Coupon has expired." });
      }

      // Check if the coupon has reached its usage limit
      if (coupon.usedCount >= coupon.usageLimit) {
          return res.status(400).json({ success: false, message: "Coupon usage limit reached." });
      }

      // Check minimum purchase amount
      if (grandTotal < coupon.minPurchaseAmount) {
          return res.status(400).json({ 
              success: false, 
              message: `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required to use this coupon.` 
          });
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discountType === "percentage") {
          discount = (grandTotal * coupon.discountValue) / 100;
          
          // Apply max discount cap if applicable
          if (coupon.maxDiscount && discount > coupon.maxDiscount) {
              discount = coupon.maxDiscount;
          }
      } else {
          discount = coupon.discountValue; // Fixed discount
      }

      const finalAmount = grandTotal - discount;

      return res.status(200).json({
          success: true,
          message: "Coupon applied successfully!",
          discount,
          finalAmount
      });

  } catch (error) {
      console.error("Error applying coupon:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.cancelcoupon = (req,res) =>{
  req.session.appliedCoupon = null;
  res.redirect('/ordersummary');
}
exports.placeOrder = async (req, res) => {
  try {
    const { products, paymentMethod, grandTotal } = req.body;
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) return res.redirect('/login');

    // Validate grandTotal
    const totalAmount = parseFloat(grandTotal);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "Invalid total amount." });
    }

    // Validate Products
    const productEntries = Object.values(products);
    for (const product of productEntries) {
      product.offerPrice = parseFloat(product.offerPrice || 0);
      product.price = parseFloat(product.price);
      product.quantity = parseInt(product.quantity, 10);

      if (isNaN(product.price) || isNaN(product.quantity) || product.quantity <= 0) {
        return res.status(400).json({ message: "Invalid product price or quantity." });
      }

      // Check stock availability
      const dbProduct = await Product.findById(product.productId);
      if (!dbProduct) {
        return res.status(404).json({ message: `Product ${product.productId} not found.` });
      }
      if (dbProduct.stock < product.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${dbProduct.name}.` });
      }
    }

    // Find default address
    const lastOrder = await Order.findOne({ user: userId }).sort({ createdAt: -1 }).select('shippingAddress');
    const defaultAddress = await Address.findOne({ userId, isDefault: true }) || null;
    const checkoutAddress = lastOrder ? lastOrder.shippingAddress : defaultAddress;

    if (!checkoutAddress) {
      return res.status(400).json({ message: "Shipping address is required." });
    }
    let existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' }).sort({ createdAt: -1 });
    if (existingOrder) {
      // If order exists, update it
      productEntries.forEach(product => {
        existingOrder.products.push({
          product: product.productId,
          quantity: product.quantity,
          price: product.price,
          offerPrice: product.offerPrice || 0,
          status: 'Ordered'
        });
      });
    
      existingOrder.totalAmount += totalAmount;
      existingOrder.paymentMethod = paymentMethod;
      existingOrder.shippingAddress = checkoutAddress;
      existingOrder.paymentStatus = paymentMethod === 'COD' ? 'Pending' : 'Completed';
    
      await existingOrder.save();
    }
    // **COD: Directly confirm order**
    if (paymentMethod === "COD") {
      existingOrder.paymentStatus = "Pending";
      existingOrder.orderStatus = "Ordered";
      await existingOrder.save();

      // Reduce stock safely
      for (const item of productEntries) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
      }

      // Clear user's cart in the database
      await Cart.deleteMany({ userId: userId });

      return res.json({
        success: true,
        redirectUrl: "/success"
    });    
    }
    // Create Razorpay Order
try {
  const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // Convert to paise
      currency: "INR",
      receipt: existingOrder._id.toString()
  });

  // Store Razorpay Order ID in the database
  existingOrder.razorpayOrderId = razorpayOrder.id;
  existingOrder.paymentStatus = "Pending"; // Payment is not completed yet
  existingOrder.orderStatus = "Ordered"; 
  await existingOrder.save();

  return res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      orderId: existingOrder._id,
      amount: totalAmount,
      key: process.env.RAZORPAY_KEY_ID,
      paymentMethod
  });

} catch (error) {
  console.error("Error creating Razorpay order:", error);
  return res.status(500).json({ message: "Failed to initiate payment. Please try again." });
}

  } catch (error) {
    console.error('Error placing order:', error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    const userId = req.session.user.id
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });

    // Verify Razorpay Signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed." });
    }

    // Update Order Status
    order.paymentStatus = "Completed";
    order.orderStatus = "Ordered";
    order.razorpayOrderId = razorpay_order_id;
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    // Reduce Stock
    for (const item of order.products) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
    }

    // Clear user's cart in the database
    await Cart.deleteMany({ userId: userId });

    // Render the success page and send the HTML as response
    res.render('user/success', { 
      orderId: order._id, 
      user: req.session.user || null 
    }, (err, html) => {
      if (err) {
        console.error("Error rendering success page:", err);
        return res.status(500).json({ message: "Error rendering success page." });
      }
      res.json({ success: true, html });
    });

  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({ message: "Payment verification failed." });
  }
};
exports.getSuccessPage = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); // Redirect if the user is not logged in
  }

  try {
    // Find the latest order for the logged-in user
    const latestOrder = await Order.findOne({ user: req.session.user.id })
      .sort({ createdAt: -1 }) // Sort to get the most recent order
      .select('_id'); // Select only the order ID

    if (!latestOrder) {
      return res.status(404).send("No recent orders found.");
    }

    res.render('user/success', { 
      user: req.session.user.id, 
      orderId: latestOrder._id 
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).send("Internal Server Error");
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
          return res.status(400).json({ message: "Product cannot be cancelled" });
      }

      order.products[productIndex].status = 'Cancelled';
      order.products[productIndex].cancellationReason = reason;
      await order.save();

      res.json({ message: "Product cancelled successfully." });
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
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    console.log(orderId)
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.isCancelled) {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }
    order.isCancelled = true;
    order.orderStatus = 'Cancelled';
    order.cancellationReason = reason;
    order.products = order.products.map(product => ({
      ...product,
      status: 'Cancelled',
      cancellationReason: reason
    }));
    order.markModified('products');

    await order.save();

    return res.status(200).json({ message: 'Order cancelled successfully', order,success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
exports.returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.orderStatus === 'Returned') {
      return res.status(400).json({ message: 'Order is already returned' });
    }
    order.orderStatus = 'Returned';
    order.returnReason = reason;
    order.products = order.products.map(product => ({
      ...product,
      status: 'Returned',
      returnReason: reason
    }));
    order.markModified('products');
    await order.save();
    res.json({ success: true, message: 'Order returned successfully', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error returning order' });
  }
};

// exports.orderCreate = async (req, res) => {
//   try {
//       const options = {
//           amount: 50000, // Amount in paise (₹500.00)
//           currency: "INR",
//           receipt: "order_rcptid_11"
//       };

//       const order = await razorpay.orders.create(options);
//       res.json(order);
//   } catch (error) {
//       res.status(500).json({ error: error.message });
//   }
// };
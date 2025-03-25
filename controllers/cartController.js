const Cart = require('../models/Cart');
const Product = require('../models/product');
const User = require('../models/User');
const Address = require('../models/address');
const Order = require('../models/order');
const product = require('../models/product');
const Coupon = require('../models/coupon');
const Wallet = require('../models/wallet'); 
require('dotenv').config();
const Razorpay = require('razorpay');
const crypto = require("crypto");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_SECRET  
});
exports.addToCart = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    // Get user ID for normal and Google users
    const userId = req.session.user.id || req.session.user.googleId;
    if (!userId) {
      return res.redirect('/login');
    }

    const { productId, quantity } = req.body;

    // Validate quantity
    const requestedQuantity = parseInt(quantity, 10);
    if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
      return res.redirect(`/product/${productId}?error=Invalid quantity`);
    }

    // Fetch product and check stock availability
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if cart item already exists
    let cartItem = await Cart.findOne({ userId, productId });

    if (cartItem) {
      const newTotalQuantity = cartItem.quantity + requestedQuantity;

      if (newTotalQuantity > product.stock) {
        return res.redirect(`/product/${productId}?error=Insufficient stock available!`);
      }

      cartItem.quantity = newTotalQuantity;
      await cartItem.save();
    } else {
      if (requestedQuantity > product.stock) {
        return res.redirect(`/product/${productId}?error=Insufficient stock available!`);
      }

      cartItem = new Cart({ userId, productId, quantity: requestedQuantity });
      await cartItem.save();
    }

    return res.redirect('/cart');
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).render("user/404");
  }
};

  exports.viewCart = async (req, res) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
  
    try {
      const userId = req.session.user.id || req.session.user.googleId;
      const user = await User.findById(userId); 
  
      if (!user) {
        return res.redirect('/login'); 
      }
  
      const cartItems = await Cart.find({ userId: userId }).populate('productId');
      if (!cartItems || cartItems.length === 0) {
        return res.render('user/cart', { cart: [], user }); 
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
      res.status(500).render("user/404");
    }
  };  
  exports.updateQuantity = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // Support both regular and Google users
        const userId = req.session.user.id || req.session.user.googleId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { cartItemId, quantity } = req.body;

        // Validate quantity
        const updatedQuantity = parseInt(quantity, 10);
        if (isNaN(updatedQuantity) || updatedQuantity <= 0) {
            return res.status(400).json({ success: false, message: "Invalid quantity" });
        }

        // Find the cart item by its ID (not product ID)
        const cartItem = await Cart.findOne({ _id: cartItemId, userId }).populate("productId");

        if (!cartItem) {
            return res.status(404).json({ success: false, message: "Cart item not found" });
        }

        const product = cartItem.productId;
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Check if requested quantity exceeds stock
        if (updatedQuantity > product.stock) {
            return res.status(400).json({ success: false, message: "Stock limit reached" });
        }

        // Update cart quantity
        cartItem.quantity = updatedQuantity;
        await cartItem.save();

        return res.json({
            success: true,
            updatedQuantity: cartItem.quantity,
            updatedSubTotal: (cartItem.quantity * product.offerPrice).toFixed(2),
        });

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

    const userId = req.session.user.id || req.session.user.googleId;
    const productId = req.params.productId;

    const result = await Cart.findOneAndDelete({ userId, productId });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Product not found in cart' });
    }

    return res.json({ success: true, message: 'Product removed from cart' });
  } catch (error) {
    console.error('Error removing product from cart:', error);
    res.status(500).render("user/404");
  }
};
exports.getCheckoutPage = async (req, res) => {
  try {
      if (!req.session.user) {
          return res.redirect('/login');
      }

      const userId = req.session.user.id || req.session.user.googleId;
      const user = await User.findById(userId);
      if (!user) {
          return res.status(404).send('User not found');
      }

      const cartItems = await Cart.find({ userId });
      if (!cartItems || cartItems.length === 0) {
          return res.redirect('/cart'); 
      }

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

      const userId = req.session.user.id || req.session.user.googleId;
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
      const userId = req.session.user.id || req.session.user.googleId;

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
    const userId = req.session.user.id || req.session.user.googleId;
      const paymentMethod = req.body.paymentMethod || 'COD';
      if (!userId) {
          return res.redirect('/login'); 
      }
      const user = await User.findById(userId).lean();
      if (!user) {
          return res.redirect('/checkoutaddress'); 
      }
      const totalAmount = req.body.totalAmount || 0;;
      let existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' })

      if (!existingOrder) {
          let shippingAddress = user.checkoutAddress;
          if (!shippingAddress) {
            const defaultAddress = await Address.findOne({ userId, isDefault: true });
            if (defaultAddress) {
                shippingAddress = defaultAddress;
            }
        }
          if (!shippingAddress) {
              return res.redirect('/checkoutaddress');
          }
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

      res.redirect('/checkout-2'); 

  } catch (error) {
      console.error("Error proceeding to payment:", error);
      res.status(500).render("user/404");
  }
};
exports.getCheckoutPage2 = async (req, res) => {
  try {
    const userId = req.session.user.id || req.session.user.googleId;
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
    const userId = req.session.user.id || req.session.user.googleId;
    
    if (!paymentMethod) {
      return res.redirect('/checkout-1');
    }
    
    let existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' })
      .sort({ createdAt: -1 });
    
    if (!existingOrder) {
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
    let user = req.session.logstate ? req.session.user : null;
    const userId = req.session.user.id || req.session.user.googleId;
    const cartItems = await Cart.find({ userId }).populate('productId');
    if (!cartItems || cartItems.length === 0) {
      return res.redirect('/cart'); 
    }
    const orderDetails = await Order.findOne({ 'shippingAddress.userId': userId }).sort({ createdAt: -1 });
    if (!orderDetails) {
      return res.redirect('/checkout-1');
    }
    const currentDate = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      isDeleted: false,
      expiryDate: { $gte: currentDate }, 
      $expr: { $lt: ["$usedCount", "$usageLimit"] }
    });
    const { shippingAddress, paymentMethod } = orderDetails;
    const orderSummaryData = {
      cartItems,
      shippingAddress,
      paymentMethod,
      coupons
    };
    const appliedCoupon = req.session.appliedCoupon || null; 
    const discount = req.session.discount || 0;
    res.render('user/ordersummary', { user, orderSummaryData,discount,appliedCoupon,discountAmount:'null'});
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
      if (new Date() > coupon.expiryDate) {
          return res.status(400).json({ success: false, message: "Coupon has expired." });
      }
      if (coupon.usedCount >= coupon.usageLimit) {
          return res.status(400).json({ success: false, message: "Coupon usage limit reached." });
      }
      if (grandTotal < coupon.minPurchaseAmount) {
          return res.status(400).json({ 
              success: false, 
              message: `Minimum purchase amount of ₹${coupon.minPurchaseAmount} required to use this coupon.` 
          });
      }
      let discountAmount = 0;
      if (coupon.discountType === "percentage") {
          discountAmount = (grandTotal * coupon.discountValue) / 100;
      } else {
          discountAmount = coupon.discountValue; 
      }
      discountAmount = Math.min(discountAmount, grandTotal);
      discountAmount = parseFloat(discountAmount.toFixed(2));

      const finalAmount = grandTotal - discountAmount;
      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
      return res.status(200).json({
          success: true,
          message: "Coupon applied successfully!",
          discountAmount, 
          finalAmount,
          appliedCoupon: couponCode 
      });

  } catch (error) {
      console.error("Error applying coupon:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.cancelCoupon = async (req, res) => {
  try {
      const { appliedCoupon, originalAmount, discountAmount } = req.body;
      if (!appliedCoupon) {
          return res.status(400).json({ success: false, message: "No coupon applied to cancel." });
      }
      const coupon = await Coupon.findOne({ code: appliedCoupon });

      if (!coupon) {
          return res.status(400).json({ success: false, message: "Invalid coupon." });
      }
      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: -1 } });
      const originalAmount1 = originalAmount + discountAmount
      req.session.appliedCoupon = null;

      return res.status(200).json({
          success: true,
          message: "Coupon removed successfully!",
          originalAmount1
      });

  } catch (error) {
      console.error("Error removing coupon:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
exports.placeOrder = async (req, res) => {
  try {
    const { products, paymentMethod, grandTotal, couponCode } = req.body;
    const userId = req.session.user?.id;
    console.log(userId)
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const user = await User.findById(userId);
    if (!user) return res.redirect('/login');

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      await new Wallet({ userId, balance: 0, transactions: [] }).save();
    }
    console.log(wallet)
    const totalAmount = parseFloat(grandTotal);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: "Invalid total amount." });
    }

    const productEntries = Object.values(products);
    for (const product of productEntries) {
      product.offerPrice = parseFloat(product.offerPrice || 0);
      product.price = parseFloat(product.price);
      product.quantity = parseInt(product.quantity, 10);

      if (isNaN(product.price) || isNaN(product.quantity) || product.quantity <= 0) {
        return res.status(400).json({ message: "Invalid product price or quantity." });
      }

      const dbProduct = await Product.findById(product.productId);
      if (!dbProduct) {
        return res.status(404).json({ message: `Product ${product.productId} not found.` });
      }

      if (dbProduct.stock < product.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${dbProduct.name}.` });
      }
    }

    let appliedCoupon = null;
    if (couponCode) {
      appliedCoupon = await Coupon.findOne({ code: couponCode });

      if (!appliedCoupon) {
        return res.status(400).json({ message: "Invalid coupon code." });
      }
      await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usedCount: 1 } });
    }

    const lastOrder = await Order.findOne({ user: userId }).sort({ createdAt: -1 }).select('shippingAddress');
    const defaultAddress = await Address.findOne({ userId, isDefault: true }) || null;
    const checkoutAddress = lastOrder ? lastOrder.shippingAddress : defaultAddress;

    if (!checkoutAddress) {
      return res.status(400).json({ message: "Shipping address is required." });
    }

    let existingOrder = await Order.findOne({ user: userId, orderStatus: 'Pending' }).sort({ createdAt: -1 });

    if (!existingOrder) {
      existingOrder = new Order({
        user: userId,
        products: [],
        totalAmount: totalAmount,
        paymentMethod,
        shippingAddress: checkoutAddress,
        paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Completed',
        orderStatus: 'Pending',
        appliedCoupon: appliedCoupon ? appliedCoupon.code : null
      });
    }

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

    if (appliedCoupon) {
      existingOrder.appliedCoupon = appliedCoupon.code;
    }

    await existingOrder.save();

    if (paymentMethod === "Wallet") {
      if (wallet.balance >= totalAmount) {
        wallet.balance -= totalAmount;
        wallet.transactions.push({
          transactionType: "debit",
          amount: totalAmount,
          description: "placed_using_wallet"
        });

        existingOrder.paymentStatus = "Completed";
        existingOrder.orderStatus = "Ordered";

        await wallet.save();
        await existingOrder.save();

        for (const item of productEntries) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: -item.quantity } },
            { new: true }
          );
        }

        await Cart.deleteMany({ userId });

        return res.json({ success: true, redirectUrl: "/success" });
      } else {
        const shortfall = totalAmount - wallet.balance;
        return res.json({
          success: false,
          message: `Insufficient wallet balance. You need ₹${shortfall} more to place this order.`,
        });
      }
    }

    if (paymentMethod === "COD") {
      if (totalAmount > 500) {
        return res.json({
          success: false,
          message: "COD is only available for orders below ₹500. Please choose another payment method."
        });
      }

      existingOrder.paymentStatus = "Pending";
      existingOrder.orderStatus = "Ordered";
      await existingOrder.save();

      for (const item of productEntries) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
      }

      await Cart.deleteMany({ userId });

      return res.json({ success: true, redirectUrl: "/success" });
    }

    try {
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: existingOrder._id.toString()
      });

      existingOrder.razorpayOrderId = razorpayOrder.id;
      existingOrder.paymentStatus = "Pending";
      existingOrder.orderStatus = "Pending";

      if (appliedCoupon) {
        existingOrder.appliedCoupon = appliedCoupon.code;
      }

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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId, couponCode } = req.body;
    const userId = req.session.user.id || req.session.user.googleId;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed." });
    }
    order.paymentStatus = "Completed";
    order.orderStatus = "Ordered";
    order.razorpayOrderId = razorpay_order_id;
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();
    for (const item of order.products) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
    }
    await Cart.deleteMany({ userId: userId });
    let appliedCoupon = null;
    if (couponCode) {
      appliedCoupon = await Coupon.findOne({ code: couponCode });

      if (!appliedCoupon) {
        return res.status(400).json({ message: "Invalid coupon code." });
      }
      await Coupon.findByIdAndUpdate(appliedCoupon._id, { $inc: { usedCount: 1 } });
    }
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
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    // Support both regular and Google users
    const userId = req.session.user.id || req.session.user.googleId;
    if (!userId) {
      return res.redirect('/login');
    }

    // Find the latest order of the user
    const latestOrder = await Order.findOne({ user: userId })
      .sort({ createdAt: -1 }) 
      .select('_id');

    if (!latestOrder) {
      return res.status(404).send("No recent orders found.");
    }

    res.render('user/success', { 
      user: userId, 
      orderId: latestOrder._id 
    });

  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).render("user/404");
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
      const canceledQuantity = order.products[productIndex].quantity;
      const product = await Product.findById(productId);
      if (product) {
          product.stock += canceledQuantity; 
          await product.save();
      }
      await order.save();
      res.json({ message: "Product cancelled successfully, stock updated." });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
  }
};
exports.returnProduct = async (req, res) => {
  try {
      const { orderId, productId, reason } = req.body;
      const order = await Order.findById(orderId).populate('user');
      if (!order) {
          return res.status(404).json({ message: "Order not found" });
      }
      const productIndex = order.products.findIndex(p => p.product.toString() === productId);
      if (productIndex === -1) {
          return res.status(404).json({ message: "Product not found in order" });
      }
      const productDetails = order.products[productIndex];
      if (productDetails.status !== 'Delivered') {
          return res.status(400).json({ message: "Product cannot be returned" });
      }
      productDetails.status = 'Returned';
      productDetails.returnReason = reason;
      order.isReturned = true;
      await order.save();
      const product = await Product.findById(productId);
      if (product) {
          product.stock += productDetails.quantity;
          await product.save();
      }
      if (order.paymentMethod === 'COD') {
          let wallet = await Wallet.findOne({ userId: order.user._id });
          if (!wallet) {
              wallet = new Wallet({ userId: order.user._id, balance: 0, transactions: [] });
          }
          const refundAmount = productDetails.price * productDetails.quantity;
          wallet.balance += refundAmount;
          wallet.transactions.push({
              transactionType: 'credit',
              amount: refundAmount,
              description: 'return',
          });

          await wallet.save();
      }

      res.json({ message: "Product returned successfully and amount credited to wallet if applicable." });

  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
  }
};
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const order = await Order.findById(orderId).populate('user');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.isCancelled) {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    // Update order status
    order.isCancelled = true;
    order.orderStatus = 'Cancelled';
    order.cancellationReason = reason;

    const refundAmount = order.totalAmount;

    // Update product stock and calculate refund
    for (let item of order.products) {
      item.status = 'Cancelled';
      item.cancellationReason = reason;
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }
    order.markModified('products');

    if (
      (order.paymentMethod === 'Online Payment' && order.paymentStatus === 'Completed') || 
      order.paymentMethod === 'Wallet' && order.paymentStatus === 'Completed') {
    
      let wallet = await Wallet.findOne({ userId: order.user._id });
    
      if (!wallet) {
        wallet = new Wallet({ userId: order.user._id, balance: 0, transactions: [] });
      }
      wallet.balance += refundAmount;
    
      wallet.transactions.push({
        transactionType: 'credit',
        amount: refundAmount,
        orderId:orderId,
        description: 'cancel',
      });
    
      await wallet.save();
      console.log("Wallet updated successfully:", wallet);
    
      order.paymentStatus = 'Refunded';
    }    
    await order.save();
    return res.status(200).json({ success: true, message: 'Order cancelled successfully, stock updated, and refund processed if applicable.', order });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Error cancelling order' });
  }
};
exports.returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const order = await Order.findById(orderId).populate('user');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.orderStatus === 'Returned') {
      return res.status(400).json({ message: 'Order is already returned' });
    }
    order.orderStatus = 'Returned';
    order.returnReason = reason;

    let refundAmount = 0;
    for (let item of order.products) {
      item.status = 'Returned';
      item.returnReason = reason;
      refundAmount += item.price * item.quantity;
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    order.markModified('products');
    await order.save();
    if (order.paymentMethod === 'COD') {
      let wallet = await Wallet.findOne({ userId: order.user._id });
      if (!wallet) {
        wallet = new Wallet({ userId: order.user._id, balance: 0, transactions: [] });
      }
      wallet.balance += refundAmount;
      wallet.transactions.push({
        transactionType: 'credit',
        amount: refundAmount,
        orderId:orderId,
        description: 'return',
      });
      await wallet.save();
    }
    return res.json({ success: true, message: 'Order returned successfully, stock updated, and refund processed if applicable.', order });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Error returning order' });
  }
};
exports.getWallet = async (req, res) => {
  try {
      if (!req.session.user) {
          return res.redirect('/login');
      }

      // Support both normal and Google users
      const userId = req.session.user.id || req.session.user.googleId;
      if (!userId) {
          return res.redirect('/login');
      }

      const wallet = await Wallet.findOne({ userId })
          .populate('userId', 'username')
          .populate('transactions.orderId', 'totalAmount orderStatus orderedAt'); // Populate order details

      if (!wallet) {
          return res.render('user/wallet', { wallet: { balance: 0, transactions: [] } });
      }

      const modifiedTransactions = wallet.transactions.map(transaction => {
          const transactionObj = transaction.toObject();

          if (["return", "cancel"].includes(transaction.description.toLowerCase()) && transaction.orderId) {
              transactionObj.isReturnOrCancel = true;
              transactionObj.orderDetails = transaction.orderId; // Attach order details
          } else {
              transactionObj.isReturnOrCancel = false;
          }

          return transactionObj;
      });

      const updatedWallet = {
          ...wallet.toObject(),
          transactions: modifiedTransactions,
      };

      res.render('user/wallet', { wallet: updatedWallet });
  } catch (error) {
      console.error("Error fetching wallet details:", error);
      res.status(500).render("user/404");
  }
};



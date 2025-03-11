module.exports = (req, res, next) => {
    res.status(404).render("user/404", { title: "Page Not Found" });
  };
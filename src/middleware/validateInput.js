const { normalizeFormData } = require('../services/geminiService');

module.exports = (req, res, next) => {
    const { formData } = req.body;

    console.log('Received formData:', JSON.stringify(formData, null, 2));

    // Check if formData exists and is an object
    if (!formData || typeof formData !== "object" || !formData.personalInfo) {
        return res.status(400).json({ error: "Invalid formData format. Ensure 'formData' contains 'personalInfo'." });
    }

    // Normalize the input data
    try {
        req.body.formData = normalizeFormData(formData);
    } catch (err) {
        console.error('Error normalizing formData:', err.message);
        return res.status(400).json({ error: "Error processing formData." });
    }

    next();
};

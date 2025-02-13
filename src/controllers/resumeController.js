const geminiService = require('../services/geminiService');

exports.completeResumeProcess = async (req, res, next) => {
    try {
        const { formData } = req.body;

        console.log('Received formData:', JSON.stringify(formData, null, 2));

        if (!formData || !formData.personalInfo) {
            return res.status(400).json({ error: 'FormData with personalInfo is required.' });
        }

        // Add detailed logging
        console.log('Processing resume with formData structure:', Object.keys(formData));

        const formattedResume = await geminiService.completeResumeProcess(formData);

        console.log('Resume processing completed successfully');

        res.status(200).json({ success: true, formattedResume });
    } catch (err) {
        // Enhanced error logging
        console.error('Detailed error in resume process:', {
            message: err.message,
            stack: err.stack,
            formData: req.body.formData
        });
        res.status(500).json({
            error: 'Failed to process the resume.',
            details: err.message
        });
    }
};
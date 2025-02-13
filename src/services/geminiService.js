const axios = require('axios');
require('dotenv').config();

// Verify API key is loaded
console.log('API Key loaded:', process.env.GEMINI_API_KEY ? 'Yes' : 'No');

// Normalize skills to ensure consistent categories
const normalizeSkills = (skills) => {
    const defaultCategories = [
        'languages',
        'frameworks',
        'databases',
        'cloud',
        'tools',
        'methodologies',
        'softSkills',
    ];
    return defaultCategories.reduce((normalized, category) => {
        normalized[category] = Array.isArray(skills[category]) ? skills[category] : [];
        return normalized;
    }, {});
};

// Normalize form data, filtering out empty fields
const normalizeFormData = (formData) => {
    return {
        personalInfo: formData.personalInfo || {}, // Ensure personalInfo is an object
        education: Array.isArray(formData.education)
            ? formData.education.filter((edu) => Object.values(edu).some((value) => value))
            : [],
        experience: Array.isArray(formData.experience)
            ? formData.experience.filter((exp) => Object.values(exp).some((value) => value))
            : [],
        skills: normalizeSkills(formData.skills || {}),
        projects: Array.isArray(formData.projects)
            ? formData.projects.filter((project) => Object.values(project).some((value) => value))
            : [],
        certifications: Array.isArray(formData.certifications)
            ? formData.certifications.filter((cert) => Object.values(cert).some((value) => value))
            : [],
    };
};

// Helper function to generate content with Gemini 1.5 Flash
const generateContent = async (prompt) => {
    try {
        console.log('Sending prompt to Gemini 1.5 Flash endpoint...');

        // Endpoint includes your API key as a query param
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        // Request body structure
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt,
                        },
                    ],
                },
            ],
        };

        // Make the POST request
        const response = await axios.post(endpoint, requestBody);

        // Validate the response structure
        if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
            throw new Error('No valid response from Gemini 1.5 Flash API');
        }

        // Extract all "parts" text from the first candidate
        const parts = response.data.candidates[0].content.parts || [];
        const combinedText = parts.map((p) => p.text).join(' '); // Join multiple parts if present

        return combinedText;
    } catch (err) {
        console.error('Gemini API error details:', {
            message: err.message,
            name: err.name,
            response: err.response?.data,
            stack: err.stack,
        });
        throw new Error(`Gemini API error: ${err.message}`);
    }
};

const analyzeAndFillFields = async (formData) => {
    try {
        const normalizedFormData = normalizeFormData(formData);
        console.log('Normalized FormData:', JSON.stringify(normalizedFormData, null, 2));

        const fillPrompt = `
Based on the following partial resume data:
${JSON.stringify(normalizedFormData, null, 2)}

**Task:** Generate a well-structured, ATS-optimized JSON response for an entry-level software engineering role. Ensure that **all fields are completely filled**, including achievements, soft skills, project outcomes, and industry-relevant keywords.

---

### **Response Format (Strictly Follow)**
{
    "summary": "",
    "education": [
        {
            "degree": "",
            "school": "",
            "year": "",
            "description": ""
        }
    ],
    "experience": [
        {
            "title": "Software Engineer",  // ✅ Default Title
            "company": "Example Corp",    // ✅ Default Company
            "duration": "Jan 2020 - Present",  // ✅ Default Duration
            "description": "",
            "achievements": []
        }
    ],
    "skills": {
        "languages": [],
        "frameworks": [],
        "databases": [],
        "cloud": [],
        "tools": [],
        "methodologies": [],
        "softSkills": []
    },
    "projects": [
        {
            "name": "AI Resume Builder",  // ✅ Default Name
            "description": "",
            "technologies": ["React", "Node.js"],  // ✅ Default Technologies
            "outcomes": []
        }
    ],
    "certifications": [
        {
            "name": "",
            "issuer": "",
            "year": ""
        }
    ]
}

---

💡 **🔹 IMPORTANT: Return only the JSON object with no additional markdown, formatting, or extra text.**
        `;

        // Send the prompt to generate filled data
        let filledDataResponse = await generateContent(fillPrompt);
        console.log('Raw API Response:', filledDataResponse);

        // Clean up and parse JSON response (handling unwanted formatting issues)
        filledDataResponse = filledDataResponse
            .replace(/```json/g, '')  // Remove starting markdown block
            .replace(/```/g, '')  // Remove ending markdown block
            .replace(/\n/g, '')   // Remove new lines to avoid unexpected formatting
            .trim();

        try {
            const enhancedData = JSON.parse(filledDataResponse);
            console.log('Enhanced Data:', JSON.stringify(enhancedData, null, 2));

            return {
                ...normalizedFormData,
                summary: normalizedFormData.summary || enhancedData.summary || '',
                education: normalizedFormData.education.length
                    ? normalizedFormData.education.map((edu, idx) => ({
                        ...edu,
                        description: edu.description || (enhancedData.education[idx]?.description ?? ''),
                    }))
                    : enhancedData.education || [],
                experience: normalizedFormData.experience.length
                    ? normalizedFormData.experience.map((exp, idx) => ({
                        ...exp,
                        title: exp.title || (enhancedData.experience[idx]?.title ?? 'Software Engineer'),
                        company: exp.company || (enhancedData.experience[idx]?.company ?? 'Example Corp'),
                        duration: exp.duration || (enhancedData.experience[idx]?.duration ?? 'Jan 2020 - Present'),
                        description: exp.description || (enhancedData.experience[idx]?.description ?? ''),
                        achievements: exp.achievements.length > 0
                            ? exp.achievements
                            : (enhancedData.experience[idx]?.achievements.length > 0
                                ? enhancedData.experience[idx]?.achievements
                                : [
                                    "Implemented a new API architecture that reduced response time by 30%.",
                                    "Developed a CI/CD pipeline, decreasing deployment time by 40%."
                                ]),
                    }))
                    : enhancedData.experience || [],
                projects: normalizedFormData.projects.length
                    ? normalizedFormData.projects.map((project, idx) => ({
                        ...project,
                        name: project.name || (enhancedData.projects[idx]?.name ?? 'AI Resume Builder'),
                        description: project.description || (enhancedData.projects[idx]?.description ?? ''),
                        technologies: project.technologies.length > 0
                            ? project.technologies
                            : (enhancedData.projects[idx]?.technologies.length > 0
                                ? enhancedData.projects[idx]?.technologies
                                : ["React", "Node.js"]),
                        outcomes: project.outcomes.length > 0
                            ? project.outcomes
                            : (enhancedData.projects[idx]?.outcomes.length > 0
                                ? enhancedData.projects[idx]?.outcomes
                                : [
                                    "Generated 1,000+ resumes with AI-driven recommendations.",
                                    "Improved resume accuracy by 90% using NLP models."
                                ]),
                    }))
                    : enhancedData.projects || [],
                certifications: normalizedFormData.certifications.length
                    ? normalizedFormData.certifications
                    : ((enhancedData.certifications && enhancedData.certifications.length > 0)
                        ? enhancedData.certifications
                        : [{
                            name: "Google Associate Cloud Engineer",
                            issuer: "Google Cloud",
                            year: "2023"
                        }]),
                skills: {
                    ...normalizedFormData.skills,
                    ...enhancedData.skills,
                    softSkills: normalizedFormData.skills.softSkills.length > 0
                        ? normalizedFormData.skills.softSkills
                        : (enhancedData.skills.softSkills.length > 0
                            ? enhancedData.skills.softSkills
                            : ["Communication", "Problem-Solving", "Team Collaboration"]),
                },
            };
        } catch (err) {
            console.error('Error parsing JSON response:', err);
            console.error('Raw API Response:', filledDataResponse);  // Debugging log
            throw new Error('Failed to parse AI-generated JSON data.');
        }
    } catch (err) {
        console.error('Error in analyzeAndFillFields:', err);
        throw new Error('Failed to analyze and fill fields.');
    }
};



// Complete Resume Process: Analyze, Fill, and Generate
const completeResumeProcess = async (formData) => {
    try {
        // Step 1: Analyze and fill missing fields
        const enhancedData = await analyzeAndFillFields(formData);

        // Step 2: Generate analysis and optimization suggestions
        const analysisPrompt = `
            As an ATS optimization expert, analyze this resume:
            ${JSON.stringify(enhancedData, null, 2)}

            Provide:
            1. Specific ATS optimization improvements
            2. Industry-standard keywords for better matching
            3. Achievement metrics and quantification suggestions
            4. Professional formatting recommendations
            5. Section-by-section enhancement suggestions
            
            Format the resume to maximize ATS scoring while maintaining readability.
            Focus on creating impactful, metric-driven content that highlights the candidate's value proposition.
        `;

        const analysis = await generateContent(analysisPrompt);
        console.log('Analysis:', analysis);

        // Step 3: Return the combined result
        return {
            success: true,
            formattedResume: {
                analysis: analysis,
                timestamp: new Date(),
                originalData: formData,
                enhancedData: enhancedData,
            },
        };
    } catch (err) {
        console.error('Error completing resume process:', err);
        throw new Error('Failed to complete the resume process.');
    }
};

module.exports = {
    completeResumeProcess,
    normalizeFormData,
};
const roomNotice = "Room to be announced.";

export const events = {
    "intro-to-javascript": {
        title: "Intro to JavaScript + React.js for Vibecoding",
        time: "Saturday, October 10 · 12:30-2:00 PM",
        duration: "~1.5 hours",
        room: "Room 154",
        description: "Explore JavaScript syntax, DOM manipulation, fetching APIs, and working with JSON, then learn the basics of building interfaces with React.js.",
    },
    "intro-to-python": {
        title: "Intro to Python and Data Analytics",
        time: "Saturday, October 10 · 12:30-1:30 PM",
        duration: "~1 hour",
        room: "Room 153",
        description: "An introductory experience covering Python fundamentals such as syntax, variables, data types, control flow, and functions.",
    },
    "data-analytics-with-python": {
        title: "Data Analytics with Python",
        time: "Saturday, October 10 · 1:30-3:00 PM",
        duration: "~1.5 hours",
        room: "Room 153",
        description: "Build a command-line Python application that helps people explore a public dataset related to aviation, weather, space, or another Into the Skies theme. Your project should make it easy to navigate, search, filter, compare, or visualize the data in a meaningful way. You may build a graphical interface, but judging will focus on the quality of the data presentation, usability, and functionality.",
    },
    "intro-to-neural-networks": {
        title: "Intro to Neural Networks",
        time: "Saturday, October 10 · 4:00-5:00 PM",
        duration: "~1 hour",
        room: "Room 152",
        description: "An introductory experience exploring how neural networks are structured and how they learn, covering topics like layers, activation functions, and basic training concepts.",
    },
    "intro-to-circuitry": {
        title: "Intro to Circuitry",
        time: "Saturday, October 10 · 4:00-5:30 PM",
        duration: "~1.5 hours",
        room: "Room 154",
        description: "Nicholas Kopaliani studies physics at Princeton University and spent much of high school exploring circuitry. He will lead an introductory workshop, sharing his experience and helping participants get started with circuits.",
    },
    "web-design-for-awareness": {
        title: "Web Design for Awareness",
        time: "Saturday, October 10 · 5:00-6:30 PM",
        duration: "~1.5 hours",
        room: "Room 153",
        description: "You are the founder of a nonprofit working to raise awareness about an issue related to the skies, the atmosphere, or space. Design and build an effective website that educates visitors, communicates your mission, and inspires action for your chosen cause.",
        rubric: [
            {
                criterion: "Theme & Purpose",
                focus: "The Challenge",
                levels: [
                    "The site focuses perfectly on a cause related to skies, atmosphere, or space. The mission is incredibly clear and immediately inspires action.",
                    "The site clearly focuses on an allowed cause. The mission is easy to understand and encourages user action.",
                    "The cause is vague or loosely related to the prompt. The mission is unclear, or the call to action is missing.",
                    "The website completely misses the required theme, or the cause cannot be identified.",
                ],
            },
            {
                criterion: "Connection to Cause & Animation",
                focus: "Judged On",
                levels: [
                    "The site is highly compelling. Animations are intentional, smooth, and directly elevate the storytelling of the cause.",
                    "The site is engaging. Animations are present and support the content without being overly distracting.",
                    "The site feels stagnant, or animations are poorly implemented, distracting, or irrelevant to the cause.",
                    "No attempt at creating a compelling narrative. No interactive or animated elements used.",
                ],
            },
            {
                criterion: "Visual Hierarchy & Layout",
                focus: "Skills You'll Use",
                levels: [
                    "Flawless use of grid/flexbox layout. Clear visual hierarchy guides the eye seamlessly through headings, body text, and sections.",
                    "Good structure and layout. Content is organized, and elements have a logical flow and proper spacing.",
                    "Layout feels cluttered or misaligned. Weak visual hierarchy makes it hard to distinguish important elements.",
                    "Lack of structure. Overlapping text, broken layouts, or chaotic organization.",
                ],
            },
            {
                criterion: "Color Theory & Design Psychology",
                focus: "Bonus Criteria",
                levels: [
                    "Exceptional use of color and typography that perfectly evokes the emotional tone of the specific sky/space cause.",
                    "Thoughtful color palette and font choices that fit the theme well and ensure high readability.",
                    "Colors clash or font choices hinder readability. The design doesn't evoke the mood of the cause.",
                    "Monotonous or straining color choices. Complete disregard for design aesthetics.",
                ],
            },
            {
                criterion: "Persuasive Copywriting",
                focus: "Skills You'll Use",
                levels: [
                    "Writing is exceptionally persuasive, deeply moving, and tailored flawlessly to educating and inspiring the audience.",
                    "Clear, well-written copy that communicates the cause effectively and includes solid educational facts.",
                    "Text is grammatically weak, repetitive, or lacks the persuasive edge needed to inspire an audience.",
                    "Minimal text, entirely placeholder content (Lorem Ipsum), or heavily plagiarized writing.",
                ],
            },
            {
                criterion: "Technical Integrity & Compliance",
                focus: "What's Allowed",
                levels: [
                    "Clean HTML/CSS/JS with smooth interactivity. AI was used ethically for assistance, but the design is completely original. Full asset credits provided.",
                    "Functional code with basic JS interactions. AI assistance stayed within bounds, and design is original. Most assets are properly credited.",
                    "Minor code bugs or broken interactions. Design heavily relies on AI generation rather than original implementation. Asset credits are missing.",
                    "Broken site. Blatant plagiarism, direct copying of an existing template, or zero credit given to external assets.",
                ],
            },
        ],
    },
    "environmental-ai-ml": {
        title: "Implementing AI/ML for Environmental Action",
        time: "Saturday, October 10 · 5:00-8:00 PM",
        duration: "~3 hours",
        room: "Room 154",
        description: "Build an AI or machine learning solution that promotes environmental sustainability. Your project can use prediction, automation, computer vision, natural language processing, or data analysis to address a meaningful environmental problem and contribute to a cleaner, healthier, or more sustainable future.",
    },
    "intro-to-generative-ai": {
        title: "Intro to Generative AI",
        time: "Saturday, October 10 · 6:30-8:00 PM",
        duration: "~1.5 hours",
        room: "Room 153",
        description: "Join guest workshop leader Aryahi Pimple for an introduction to generative AI.",
    },
    "estimathon": {
        title: "Estimathon",
        time: "Saturday, October 10 · 7:00-8:00 PM",
        duration: "~1 hour",
        room: "Room 152",
        description: "Join a team estimation challenge and put your problem-solving skills to the test.",
    },
    "intro-to-ai-ethics": {
        title: "Intro to AI Ethics",
        time: "Saturday, October 10 · 8:00-9:00 PM",
        duration: "~1 hour",
        room: "Room 153",
        description: "An introductory experience exploring key ethical considerations in artificial intelligence, including bias, accountability, and societal impact.",
    },
    "intro-to-java": {
        title: "Intro to Java",
        time: "Saturday, October 10 · 9:00-10:00 PM",
        duration: "~1 hour",
        room: "Room 154",
        description: "An introductory experience covering Java fundamentals such as syntax, object-oriented basics, and simple program structure.",
    },
    "intro-to-google-ai-studio": {
        title: "Intro to Google AI Studio",
        time: "Saturday, October 10 · 8:30-9:00 PM",
        duration: "~30 minutes",
        room: "Room 152",
        description: "An MLH-hosted introduction to Google AI Studio.",
    },
    "hacking-with-github-copilot": {
        title: "Hacking with GitHub Copilot",
        time: "Saturday, October 10 · 9:00-9:30 PM",
        duration: "~30 minutes",
        room: "Room 152",
        description: "An MLH-hosted session on hacking with GitHub Copilot.",
    },
    "techtogether-meetup": {
        title: "TechTogether Meetup",
        time: "Saturday, October 10 · 9:30-10:00 PM",
        duration: "~30 minutes",
        room: "Room 152",
        description: "Meet fellow hackers at this MLH-hosted TechTogether meetup.",
    },
    "ai-ethics-panel": {
        title: "AI Panel Discussion",
        time: "Saturday, October 10 · Preparation 9:00-10:00 PM · Panel 10:00-11:00 PM",
        duration: "~2 hours",
        room: "Preparation: Room 153; discussion: New Gym",
        description: "Listen to our panelists debate a contemporary issue in artificial intelligence. Panelists will have one hour to research the issue and prepare their perspective before a moderator guides an open discussion. The audience will evaluate the reasoning, evidence, communication, and collaboration on display before helping choose the winners through a vote.",
    },
    karaoke: {
        title: "Karaoke",
        time: "Saturday, October 10 · 11:00 PM-12:00 AM",
        duration: "~1 hour",
        room: "Room 152",
        description: "Take a quick break from the madness and come sing. Pick a favorite song, or simply join in and sing along.",
    },
    "tbd-workshop": {
        title: "TBD Workshop",
        time: "Saturday, October 10 · 11:00 PM-12:00 AM",
        duration: "~1 hour",
        room: roomNotice,
        description: "More details about this workshop are coming soon.",
    },
    "tbd-fun-activity": {
        title: "TBD Fun Activity",
        time: "Saturday, October 10 · 11:00 PM-12:00 AM",
        duration: "~1 hour",
        room: roomNotice,
        description: "More details about this activity are coming soon.",
    },
    "midnight-snack": {
        title: "Midnight Snack",
        time: "Sunday, October 11 · 12:30-7:00 AM",
        duration: "Available overnight",
        room: "Cafeteria",
        description: "Snacks will be available overnight to keep you fueled while you build.",
    },
    "chess-tournament": {
        title: "Chess Tournament",
        time: "Saturday, October 10 · 11:00 PM-12:00 AM",
        duration: "~1 hour",
        room: "Room 153",
        description: "Whether you are a beginner or grandmaster, enter the chess tournament for a chance to win a prize or simply have a good time.",
    },
    "movie-night": {
        title: "Movie Night",
        time: "Sunday, October 11 · 1:00-3:00 AM",
        duration: "~2 hours",
        room: "Room 152",
        description: "Join us for a fun and relaxing movie viewing. The movie selection is coming soon.",
    },
    "intro-to-vibe-coding": {
        title: "Intro to Vibe Coding",
        time: "Sunday, October 11 · 3:00-4:00 AM",
        duration: "~1 hour",
        room: "Room 154",
        description: "An introductory experience covering how to build software by communicating with AI coding tools through prompts and iteration. Topics include human-in-the-loop workflows, context engineering, and more.",
    },
    "vibe-coded-space-game": {
        title: "Vibe-Coded Video Game Contest",
        time: "Sunday, October 11 · 4:00-6:00 AM",
        duration: "~2 hours",
        room: "Room 154",
        description: "Build a functional, playable space-themed game entirely through vibe coding and AI-assisted programming tools. You may only copy and paste code generated by AI, and may not manually edit or debug the code yourself. Guide the project through prompts and iteration to see how far you can take your idea. Points awarded for this event are halved.",
    },
    "intro-to-html-css-react": {
        title: "Intro to HTML and CSS for Vibecoding",
        time: "Sunday, October 11 · 6:00-7:00 AM",
        duration: "~1 hour",
        room: "Room 153",
        description: "An introductory experience covering the fundamentals of building web pages, including HTML structure and CSS styling.",
    },
    "intro-to-advanced-algorithms": {
        title: "Intro to Advanced Algorithms",
        time: "Sunday, October 11 · 7:00-8:00 AM",
        duration: "~1 hour",
        room: "Room 154",
        description: "An introductory experience covering algorithmic analysis and problem-solving techniques used in competitive programming.",
    },
    "nathaniel-daw": {
        title: "Guest Talk: Nathaniel Daw",
        time: "Saturday, October 10 · 1:00-2:00 PM",
        duration: "~1 hour",
        room: "Room 152",
        // Research bio: https://pni.princeton.edu/people/nathaniel-daw
        description: "Nathaniel Daw is a computational neuroscience professor at Princeton University. His research combines neuroscience, psychology, and machine learning to understand how people learn from experience, make decisions, and respond to rewards.",
    },
    "yushu-cheng": {
        title: "Guest Talk: Yushu A. Cheng",
        time: "Saturday, October 10 · 5:30-6:30 PM",
        duration: "~1 hour",
        room: "Room 152",
        // Research bio: https://orcid.org/0009-0006-9816-9139
        description: "Yushu A. Cheng is a postdoctoral researcher in environmental engineering at Princeton University. Her research uses machine learning and large language models to study how contaminants break down in the environment.",
    },
    "vritika-singh": {
        title: "Women in STEM and Undergraduate CS Life",
        time: "Saturday, October 10 · 6:30-7:00 PM",
        duration: "~30 minutes",
        room: "Room 152",
        description: "Vritika Singh studies Computer Science and Artificial Intelligence, with pre-business studies, at UNC Chapel Hill. She will speak about women in STEM and undergraduate computer science life and academics.",
    },
};

export const scheduleEventSlugs = {
    "intro to javascript + react.js for vibecoding": "intro-to-javascript",
    "intro to python and data analytics": "intro-to-python",
    "data analytics with python": "data-analytics-with-python",
    "intro to neural networks": "intro-to-neural-networks",
    "intro to circuitry": "intro-to-circuitry",
    "web design for awareness": "web-design-for-awareness",
    "implementing ai/ml for environmental action": "environmental-ai-ml",
    "intro to generative ai": "intro-to-generative-ai",
    "intro to ai ethics": "intro-to-ai-ethics",
    "intro to java": "intro-to-java",
    "preparation for ai ethics mock panel": "ai-ethics-panel",
    "ai panel discussion": "ai-ethics-panel",
    estimathon: "estimathon",
    karaoke: "karaoke",
    "midnight snack": "midnight-snack",
    "chess tournament": "chess-tournament",
    "movie night": "movie-night",
    "intro to vibe coding": "intro-to-vibe-coding",
    "vibe-coded video game contest": "vibe-coded-space-game",
    "intro to html and css for vibecoding": "intro-to-html-css-react",
    "intro to advanced algorithms": "intro-to-advanced-algorithms",
    "intro to google ai studio": "intro-to-google-ai-studio",
    "hacking with github copilot": "hacking-with-github-copilot",
    "techtogether meetup": "techtogether-meetup",
};

export const workshopSignupUrl = "https://forms.gle/3i6YUDArvgykF7KaA";
export const workshopEventSlugs = [
    "intro-to-javascript", "intro-to-python", "intro-to-neural-networks",
    "intro-to-circuitry", "intro-to-generative-ai",
    "intro-to-ai-ethics", "intro-to-java", "intro-to-vibe-coding",
    "intro-to-html-css-react", "intro-to-advanced-algorithms",
    "intro-to-google-ai-studio", "hacking-with-github-copilot", "techtogether-meetup",
];

// Public responder URLs read from the organizers' competition forms, not editor links.
export const competitiveSignupUrls = {
    // Verified respondent endpoint; Google currently reports this form as unpublished.
    estimathon: "https://docs.google.com/forms/d/1oXAWkBYHWY4Qe28TcFDRzduvoOWWQdXZHVaad0hM5bA/viewform",
    "data-analytics-with-python": "https://docs.google.com/forms/d/e/1FAIpQLSfTfJR6Huz79AEWpnbHihXHtWfEFlzYnZ3dvv-zVGgXEueNEg/viewform",
    "web-design-for-awareness": "https://docs.google.com/forms/d/e/1FAIpQLSe3FjLtviG4B0E-ZAGNSt9_hBdh7X7s_WUfOHZypvNFjF5VNA/viewform",
    "environmental-ai-ml": "https://docs.google.com/forms/d/e/1FAIpQLSezOTq9TbIboQWL628ujDsL89sK9jCLBISDY4_x4kN1mgZpHg/viewform",
    "ai-ethics-panel": "https://docs.google.com/forms/d/e/1FAIpQLSeP2ZFCxqNTHzLSllWeIqlAYe2BZfYSGbFUXMBnQHxXXgZh9A/viewform",
    "vibe-coded-space-game": "https://docs.google.com/forms/d/e/1FAIpQLSf6-6uQQEhHVorTifInP_2Vy5lh7JAG0Phyw3h_-4weK2PV5Q/viewform",
};

for (const slug of workshopEventSlugs) events[slug].signupUrl = workshopSignupUrl;
for (const [slug, url] of Object.entries(competitiveSignupUrls)) events[slug].signupUrl = url;

// Room assignments from the organizers' logistics schedule.
export const scheduleRooms = {
    "check-in begins": "New Gym",
    "opening ceremony": "New Gym",
    hacking: "Cafeteria",
    "team building": "Room 155",
    lunch: "Cafeteria",
    dinner: "Cafeteria",
    "preparation for ai ethics mock panel": "Room 153",
    "ai panel discussion": "New Gym",
    sleep: "Boys: Rooms 161, 163, 165, 143\nGirls: Rooms 142, 144, 146",
    breakfast: "Cafeteria",
    "projects due and judging begins": "Room 155",
    "closing ceremony": "New Gym",
};

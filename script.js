class LifeSimulator {
    constructor() {
        this.gameState = this.loadGameState();
        this.currentScene = null;
        this.conversationHistory = [];
        this.init();
    }

    init() {
        this.updateUI();
        this.bindEvents();
        if (!this.gameState.currentScene) {
            this.generateNewScene();
        } else {
            this.loadCurrentScene();
        }
    }

    loadGameState() {
        const saved = localStorage.getItem('lifeSimulator');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            money: 50,
            mood: 'Neutral',
            day: 1,
            memories: [],
            currentScene: null,
            decisions: []
        };
    }

    saveGameState() {
        localStorage.setItem('lifeSimulator', JSON.stringify(this.gameState));
    }

    updateUI() {
        document.getElementById('money').textContent = this.gameState.money;
        document.getElementById('mood').textContent = this.gameState.mood;
        document.getElementById('day').textContent = this.gameState.day;
    }

    bindEvents() {
        document.getElementById('explore-btn').addEventListener('click', () => this.generateNewScene());
        document.getElementById('rest-btn').addEventListener('click', () => this.advanceDay());
        document.getElementById('scrapbook-btn').addEventListener('click', () => this.openScrapbook());
        
        // Modal controls
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    async generateNewScene() {
        this.showLoading();
        try {
            // Generate scene using LLM
            const scenePrompt = `Generate a realistic modern-day scene for an unemployed adult. Consider it's day ${this.gameState.day}. 
            Previous memories: ${this.gameState.memories.slice(-3).map(m => m.title).join(', ')}
            Current mood: ${this.gameState.mood}
            Money: $${this.gameState.money}
            
            Provide a JSON response with:
            - location: string (e.g., "Local Coffee Shop", "City Park", "Grocery Store")
            - description: string (detailed description of the scene)
            - atmosphere: string (mood of the place)
            - characters: array of 2-4 characters with {name, description, personality} - make them diverse and interesting`;

            const sceneResponse = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are a life simulation generator. Create realistic, engaging scenarios for an unemployed adult in the modern day. Be creative but grounded in reality. Respond only with valid JSON.`
                    },
                    {
                        role: "user",
                        content: scenePrompt
                    }
                ],
                json: true
            });

            const scene = JSON.parse(sceneResponse.content);
            
            // Generate scene image
            const sceneImage = await websim.imageGen({
                prompt: `${scene.location}: ${scene.description}, realistic modern day photography style, ${scene.atmosphere} atmosphere`,
                aspect_ratio: "16:9"
            });

            // Generate character images
            const characters = await Promise.all(scene.characters.map(async (char) => {
                const charImage = await websim.imageGen({
                    prompt: `Portrait of ${char.description}, realistic modern person, white background for transparency`,
                    transparent: true,
                    aspect_ratio: "1:1"
                });
                return {
                    ...char,
                    image: charImage.url,
                    x: Math.random() * 70 + 10, // Random position 10-80%
                    y: Math.random() * 60 + 20   // Random position 20-80%
                };
            }));

            this.currentScene = {
                ...scene,
                image: sceneImage.url,
                characters: characters,
                visited: new Date().toISOString()
            };

            this.gameState.currentScene = this.currentScene;
            this.saveGameState();
            this.renderScene();

        } catch (error) {
            console.error('Error generating scene:', error);
            alert('Failed to generate scene. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    loadCurrentScene() {
        if (this.gameState.currentScene) {
            this.currentScene = this.gameState.currentScene;
            this.renderScene();
        }
    }

    renderScene() {
        const sceneImage = document.getElementById('scene-image');
        const charactersContainer = document.getElementById('characters-container');
        const sceneDescription = document.getElementById('scene-description');

        // Set background image
        sceneImage.style.backgroundImage = `url(${this.currentScene.image})`;

        // Clear previous characters
        charactersContainer.innerHTML = '';

        // Add characters
        this.currentScene.characters.forEach((character, index) => {
            const charElement = document.createElement('div');
            charElement.className = 'character';
            charElement.style.left = `${character.x}%`;
            charElement.style.top = `${character.y}%`;
            charElement.style.backgroundImage = `url(${character.image})`;
            charElement.style.backgroundSize = 'cover';
            charElement.style.backgroundPosition = 'center';
            charElement.title = character.name;
            
            charElement.addEventListener('click', () => this.interactWithCharacter(character));
            charactersContainer.appendChild(charElement);
        });

        // Set description
        sceneDescription.innerHTML = `
            <h3>📍 ${this.currentScene.location}</h3>
            <p>${this.currentScene.description}</p>
            <p><em>Atmosphere: ${this.currentScene.atmosphere}</em></p>
        `;
    }

    async interactWithCharacter(character) {
        this.showLoading();
        try {
            const modal = document.getElementById('character-modal');
            const charImage = document.getElementById('character-image');
            const charName = document.getElementById('character-name');
            const charDesc = document.getElementById('character-description');
            const choicesContainer = document.getElementById('interaction-choices');

            // Set character info
            charImage.src = character.image;
            charName.textContent = character.name;
            charDesc.textContent = character.description;

            // Generate interaction choices using LLM
            const interactionPrompt = `Generate interaction choices for talking to ${character.name} (${character.description}) at ${this.currentScene.location}.
            Player context: Unemployed adult, Day ${this.gameState.day}, $${this.gameState.money}, mood: ${this.gameState.mood}
            
            Provide 3-4 realistic conversation starters/interaction options. Return JSON array of strings.`;

            const choicesResponse = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "Generate realistic conversation options for social interactions. Be natural and context-appropriate."
                    },
                    {
                        role: "user",
                        content: interactionPrompt
                    }
                ],
                json: true
            });

            const choices = JSON.parse(choicesResponse.content);

            // Clear and populate choices
            choicesContainer.innerHTML = '';
            choices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'choice-btn';
                button.textContent = choice;
                button.addEventListener('click', () => this.makeChoice(character, choice));
                choicesContainer.appendChild(button);
            });

            modal.classList.remove('hidden');

        } catch (error) {
            console.error('Error generating interaction:', error);
            alert('Failed to generate interaction choices.');
        } finally {
            this.hideLoading();
        }
    }

    async makeChoice(character, choice) {
        this.showLoading();
        try {
            // Generate outcome using LLM
            const outcomePrompt = `Player chose to: "${choice}" when talking to ${character.name} at ${this.currentScene.location}.
            Player context: Unemployed adult, $${this.gameState.money}, mood: ${this.gameState.mood}
            
            Generate a realistic outcome. Return JSON with:
            - dialogue: what the character says back
            - moneyChange: number (positive or negative change to money, usually 0)
            - moodChange: new mood if it changes ("Happy", "Sad", "Excited", "Worried", "Neutral", etc.)
            - memory: short description of what happened for the scrapbook`;

            const outcomeResponse = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system", 
                        content: "Generate realistic social interaction outcomes. Be natural and have appropriate consequences."
                    },
                    {
                        role: "user",
                        content: outcomePrompt
                    }
                ],
                json: true
            });

            const outcome = JSON.parse(outcomeResponse.content);

            // Apply changes
            this.gameState.money += outcome.moneyChange || 0;
            if (outcome.moodChange) {
                this.gameState.mood = outcome.moodChange;
            }

            // Add to decisions log
            this.gameState.decisions.push({
                day: this.gameState.day,
                location: this.currentScene.location,
                character: character.name,
                choice: choice,
                outcome: outcome.dialogue,
                timestamp: new Date().toISOString()
            });

            // Create memory for scrapbook with character and conversation details
            await this.addMemory(
                `${character.name} at ${this.currentScene.location}`,
                outcome.memory,
                this.currentScene.image,
                {
                    character: character,
                    choice: choice,
                    response: outcome.dialogue
                }
            );

            // Show outcome
            alert(`${character.name}: "${outcome.dialogue}"`);

            // Update UI and save
            this.updateUI();
            this.saveGameState();

            // Close modal
            document.getElementById('character-modal').classList.add('hidden');

        } catch (error) {
            console.error('Error processing choice:', error);
            alert('Something went wrong with your interaction.');
        } finally {
            this.hideLoading();
        }
    }

    async addMemory(title, description, image, conversationData = null) {
        const memory = {
            id: Date.now(),
            title: title,
            description: description,
            image: image,
            day: this.gameState.day,
            date: new Date().toLocaleDateString(),
            mood: this.gameState.mood,
            conversation: conversationData
        };

        this.gameState.memories.push(memory);
        this.saveGameState();
    }

    async advanceDay() {
        this.gameState.day++;
        
        // Reset scene for new day
        this.gameState.currentScene = null;
        
        // Small daily changes
        if (this.gameState.money > 0) {
            this.gameState.money -= Math.floor(Math.random() * 10) + 5; // Daily expenses
        }
        
        // Mood evolution
        const moods = ["Happy", "Sad", "Excited", "Worried", "Neutral", "Tired", "Hopeful"];
        if (Math.random() < 0.3) { // 30% chance mood changes
            this.gameState.mood = moods[Math.floor(Math.random() * moods.length)];
        }

        this.updateUI();
        this.saveGameState();
        
        // Generate new scene for the new day
        await this.generateNewScene();
    }

    openScrapbook() {
        const modal = document.getElementById('scrapbook-modal');
        const content = document.getElementById('scrapbook-content');

        content.innerHTML = '';

        if (this.gameState.memories.length === 0) {
            content.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;"><h3>📖 Your scrapbook is empty</h3><p>Start exploring and making decisions to create memories!</p></div>';
        } else {
            this.gameState.memories.slice().reverse().forEach(memory => {
                const card = document.createElement('div');
                card.className = 'memory-card';
                
                let conversationHtml = '';
                if (memory.conversation) {
                    conversationHtml = `
                        <div class="conversation-details">
                            <div class="conversation-choice">💬 You said: "${memory.conversation.choice}"</div>
                            <div class="conversation-response">↳ ${memory.conversation.character.name}: "${memory.conversation.response}"</div>
                        </div>
                    `;
                }
                
                card.innerHTML = `
                    <div class="memory-image" style="background-image: url(${memory.image})">
                        ${memory.conversation ? `<div class="character-portrait" style="background-image: url(${memory.conversation.character.image})" title="${memory.conversation.character.name}"></div>` : ''}
                    </div>
                    <div class="memory-title">${memory.title}</div>
                    <div class="memory-description">${memory.description}</div>
                    ${conversationHtml}
                    <div class="memory-date">
                        <span>Day ${memory.day} - ${memory.date}</span>
                        <span class="mood-indicator">${memory.mood}</span>
                    </div>
                `;
                content.appendChild(card);
            });
        }

        modal.classList.remove('hidden');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LifeSimulator();
});
  // Get references to DOM elements
        const uidInput = document.getElementById('uidInput');
        const regionSelect = document.getElementById('regionSelect');
        const fetchBtn = document.getElementById('fetchBtn');
        const loadingMessage = document.getElementById('loadingMessage');
        const errorMessage = document.getElementById('errorMessage');
        const playerInfoOutput = document.getElementById('playerInfoOutput');

        // Base URLs for the APIs
        const PLAYER_INFO_API_BASE = 'https://ff-info-uug0.onrender.com/api/ff/data';
        const IMAGE_API_BASE = 'https://ff-info-uug0.onrender.com/api/ff/images';

        // Global variable to store app.json data
        let appItemsData = [];

        /**
         * Loads the app.json data from the local file.
         */
        async function loadAppItemsData() {
            try {
                const response = await fetch('app.json'); // Assumes app.json is in the same directory
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                appItemsData = await response.json();
                console.log('app.json loaded successfully. Total items:', appItemsData.length);
            } catch (error) {
                console.error('Failed to load app.json:', error);
                errorMessage.textContent = 'Failed to load item definitions (app.json). Image lookup may be incomplete.';
                errorMessage.classList.remove('hidden');
            }
        }

        /**
         * Determines the numeric Item_ID to use for image fetching.
         * It prioritizes finding the Item_ID from appItemsData if the rawItemId matches an Item_ID or an Icon_Name.
         * If no match is found, it falls back to the original rawItemId, assuming it's already a numeric ID.
         * @param {string|number} rawItemId - The raw ID (could be numeric Item_ID or an existing Icon_Name string).
         * @returns {string} The numeric Item_ID string to use for image fetching.
         */
        function getNumericItemIdForImage(rawItemId) {
            // Convert rawItemId to string for consistent comparison
            const rawItemIdStr = String(rawItemId);

            // 1. Try to find the item by its Item_ID (most direct match for numeric IDs)
            const itemById = appItemsData.find(entry => entry.Item_ID === rawItemIdStr);
            if (itemById) {
                return String(itemById.Item_ID); // Found by Item_ID, return its canonical numeric ID
            }

            // 2. If not found by Item_ID, try to find by Icon_Name (for cases where rawItemId might be an Icon_Name string)
            const itemByIconName = appItemsData.find(entry => entry.Icon_Name === rawItemIdStr);
            if (itemByIconName) {
                return String(itemByIconName.Item_ID); // Found by Icon_Name, return its associated numeric Item_ID
            }

            // 3. If no match in app.json, assume the rawItemId itself is the numeric ID we should use
            return rawItemIdStr;
        }

        /**
         * Converts a Unix timestamp (seconds) to a formatted date and time string (DD/MM/YYYY hh:mm AM/PM IST).
         * @param {number} timestamp - Unix timestamp in seconds.
         * @returns {string} Formatted date and time string.
         */
        function formatUnixTimestampToIST(timestamp) {
            const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
            const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
            const istDate = new Date(date.getTime() + istOffsetMs); // Apply IST offset

            const hours = istDate.getUTCHours();
            const minutes = istDate.getUTCMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const formattedHours = hours % 12 || 12;
            const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

            const formattedDate = `${istDate.getUTCDate().toString().padStart(2, '0')}/${(istDate.getUTCMonth() + 1).toString().padStart(2, '0')}/${istDate.getUTCFullYear()}`;
            const formattedTime = `${formattedHours}:${formattedMinutes} ${ampm}`;

            return `${formattedDate} ${formattedTime}`;
        }

        /**
         * Creates an image element with error handling, ensuring a numeric Item_ID is used for the URL.
         * @param {string|number} rawItemId - The raw ID (could be numeric Item_ID or an existing Icon_Name) to fetch the image for.
         * @param {string} altText - Alt text for the image.
         * @returns {HTMLImageElement} The created image element.
         */
        function createImageElement(rawItemId, altText) {
            const img = document.createElement('img');
            // Always get the numeric Item_ID from app.json for image fetching
            let imageIdToUse = getNumericItemIdForImage(rawItemId);

            // Ensure the numeric ID always has a .png suffix for the image proxy
            if (!imageIdToUse.endsWith('.png')) {
                imageIdToUse += '.png';
            }

            img.src = `${IMAGE_API_BASE}?iconName=${imageIdToUse}`;
            img.alt = altText;
            img.className = 'w-full h-20 object-contain rounded-md bg-gray-700 p-1';
            img.onerror = () => {
                // Fallback to a placeholder image if the actual image fails to load
                img.src = `https://placehold.co/80x80/333333/FFFFFF?text=No+Image`;
                img.alt = `Image not found for ${altText} (ID: ${rawItemId})`;
                console.warn(`Could not load image for: ${imageIdToUse} (from raw ID: ${rawItemId}). External API might not have this image or the ID mapping is incorrect.`);
            };
            return img;
        }

        /**
         * Gets the human-readable name of an item from appItemsData.
         * @param {string|number} itemId - The Item_ID to look up.
         * @returns {string} The Name of the item if found, or 'Unknown Item'.
         */
        function getItemName(itemId) {
            const item = appItemsData.find(entry => entry.Item_ID === String(itemId));
            return item ? item.Name : 'Unknown Item';
        }

        /**
         * Creates a container div holding an image and its corresponding name.
         * @param {string|number} itemId - The raw ID of the item.
         * @param {string} altPrefix - Prefix for the alt text (e.g., "Account Avatar", "Outfit Item").
         * @returns {HTMLDivElement} A div containing the image and its name.
         */
        function createImageWithNameWrapper(itemId, altPrefix) {
            const itemName = getItemName(itemId);
            const itemWrapper = document.createElement('div');
            itemWrapper.className = 'image-name-wrapper'; // Use the new CSS class for styling

            const imgElement = createImageElement(itemId, `${altPrefix}: ${itemName}`);
            itemWrapper.appendChild(imgElement);

            const nameElement = document.createElement('p');
            nameElement.className = 'item-name-text'; // Use specific class for text styling
            nameElement.textContent = itemName;
            itemWrapper.appendChild(nameElement);

            return itemWrapper;
        }


        /**
         * Displays the fetched player data in the UI.
         * @param {object} data - The JSON data received from the player info API.
         */
        function displayPlayerData(data) {
            playerInfoOutput.innerHTML = ''; // Clear previous content

            // Account Info Card
            const accountInfo = data.AccountInfo;
            if (accountInfo) {
                const accountCard = document.createElement('div');
                accountCard.className = 'info-card col-span-1 md:col-span-2'; // Span full width on smaller screens

                // Create a container for avatar and banner
                const avatarBannerContainer = document.createElement('div');
                avatarBannerContainer.className = 'flex items-center gap-4 mb-4';

                avatarBannerContainer.appendChild(createImageWithNameWrapper(accountInfo.AccountAvatarId, 'Account Avatar'));
                avatarBannerContainer.appendChild(createImageWithNameWrapper(accountInfo.AccountBannerId, 'Account Banner'));

                accountCard.innerHTML = `
                    <h3 class="text-xl font-semibold mb-3">Account Information</h3>
                `;
                accountCard.appendChild(avatarBannerContainer); // Append the container

                accountCard.innerHTML += `
                    <p><strong>Name:</strong> ${accountInfo.AccountName}</p>
                    <p><strong>Level:</strong> ${accountInfo.AccountLevel}</p>
                    <p><strong>Region:</strong> ${accountInfo.AccountRegion}</p>
                    <p><strong>Likes:</strong> ${accountInfo.AccountLikes}</p>
                    <p><strong>Last Login:</strong> ${formatUnixTimestampToIST(accountInfo.AccountLastLogin)}</p>
                    <p><strong>Created At:</strong> ${formatUnixTimestampToIST(accountInfo.AccountCreateTime)}</p>
                    <p><strong>Release Version:</strong> ${accountInfo.ReleaseVersion}</p>
                    <p><strong>BR Max Rank:</strong> ${accountInfo.BrMaxRank} (Points: ${accountInfo.BrRankPoint})</p>
                    <p><strong>CS Max Rank:</strong> ${accountInfo.CsMaxRank} (Points: ${accountInfo.CsRankPoint})</p>
                `;
                playerInfoOutput.appendChild(accountCard);
            }

            // Guild Info Card
            const guildInfo = data.GuildInfo;
            if (guildInfo && guildInfo.GuildName) { // Check if GuildInfo and GuildName exist
                const guildCard = document.createElement('div');
                guildCard.className = 'info-card';
                guildCard.innerHTML = `
                    <h3 class="text-xl font-semibold mb-3">Guild Information</h3>
                    <p><strong>Name:</strong> ${guildInfo.GuildName}</p>
                    <p><strong>ID:</strong> ${guildInfo.GuildID}</p>
                    <p><strong>Level:</strong> ${guildInfo.GuildLevel}</p>
                    <p><strong>Members:</strong> ${guildInfo.GuildMember}/${guildInfo.GuildCapacity}</p>
                    <p><strong>Owner UID:</strong> ${guildInfo.GuildOwner}</p>
                `;
                playerInfoOutput.appendChild(guildCard);
            }

            // Equipped Outfit Card
            const equippedOutfit = data.AccountProfileInfo?.EquippedOutfit;
            if (equippedOutfit && equippedOutfit.length > 0) {
                const outfitCard = document.createElement('div');
                outfitCard.className = 'info-card';
                outfitCard.innerHTML = `
                    <h3 class="text-xl font-semibold mb-3">Equipped Outfit</h3>
                    <div class="image-grid"></div>
                `;
                const imageGrid = outfitCard.querySelector('.image-grid');
                equippedOutfit.forEach(itemId => {
                    imageGrid.appendChild(createImageWithNameWrapper(itemId, 'Outfit Item'));
                });
                playerInfoOutput.appendChild(outfitCard);
            }

            // Equipped Weapon Card
            const equippedWeapon = data.AccountInfo?.EquippedWeapon; // From AccountInfo
            const captainEquippedWeapon = data.captainBasicInfo?.EquippedWeapon; // From captainBasicInfo

            const allEquippedWeapons = [];
            if (equippedWeapon) allEquippedWeapons.push(...equippedWeapon);
            if (captainEquippedWeapon) allEquippedWeapons.push(...captainEquippedWeapon);

            // Remove duplicates if any weapon ID appears in both lists
            const uniqueEquippedWeapons = [...new Set(allEquippedWeapons)];

            if (uniqueEquippedWeapons.length > 0) {
                const weaponCard = document.createElement('div');
                weaponCard.className = 'info-card';
                weaponCard.innerHTML = `
                    <h3 class="text-xl font-semibold mb-3">Equipped Weapons</h3>
                    <div class="image-grid"></div>
                `;
                const imageGrid = weaponCard.querySelector('.image-grid');
                uniqueEquippedWeapons.forEach(itemId => {
                    imageGrid.appendChild(createImageWithNameWrapper(itemId, 'Weapon Skin'));
                });
                playerInfoOutput.appendChild(weaponCard);
            }

            // Social Info Card
            const socialInfo = data.socialinfo;
            if (socialInfo) {
                const socialCard = document.createElement('div');
                socialCard.className = 'info-card';
                socialCard.innerHTML = `
                    <h3 class="text-xl font-semibold mb-3">Social Information</h3>
                    <p><strong>Language:</strong> ${socialInfo.AccountLanguage}</p>
                    <p><strong>Preferred Mode:</strong> ${socialInfo.AccountPreferMode}</p>
                    <p><strong>Signature:</strong> ${socialInfo.AccountSignature}</p>
                `;
                playerInfoOutput.appendChild(socialCard);
            }

            // Credit Score Info Card
            const creditScoreInfo = data.creditScoreInfo;
            if (creditScoreInfo) {
                const creditCard = document.createElement('div');
                creditCard.className = 'info-card';
                creditCard.innerHTML = `
                    <h3 class="text-xl font-semibold mb-3">Credit Score</h3>
                    <p><strong>Score:</strong> ${creditScoreInfo.creditScore}</p>
                    <p><strong>Summary Start:</strong> ${formatUnixTimestampToIST(creditScoreInfo.periodicSummaryStartTime)}</p>
                    <p><strong>Summary End:</strong> ${formatUnixTimestampToIST(creditScoreInfo.periodicSummaryEndTime)}</p>
                `;
                playerInfoOutput.appendChild(creditCard);
            }

            // Pet Info Card
            const petInfo = data.petInfo;
            if (petInfo) {
                const petCard = document.createElement('div');
                petCard.className = 'info-card';
                petCard.innerHTML = `
                    <h3 class="text-xl font-semibold mb-3">Pet Information</h3>
                    <p><strong>ID:</strong> ${petInfo.id} ${petInfo.isSelected ? '(Selected)' : ''}</p>
                    <p><strong>Level:</strong> ${petInfo.level}</p>
                    <p><strong>EXP:</strong> ${petInfo.exp}</p>
                    <p><strong>Skill ID:</strong> ${petInfo.selectedSkillId}</p>
                    <p><strong>Skin ID:</strong> ${petInfo.skinId}</p>
                    <div class="image-grid">
                        ${createImageWithNameWrapper(petInfo.skinId, 'Pet Skin').outerHTML}
                    </div>
                `;
                playerInfoOutput.appendChild(petCard);
            }
        }

        /**
         * Fetches player data from the API and displays it.
         */
        async function fetchPlayerData() {
            const uid = uidInput.value.trim();
            const region = regionSelect.value;

            if (!uid) {
                errorMessage.textContent = 'Please enter a Player UID.';
                errorMessage.classList.remove('hidden');
                playerInfoOutput.innerHTML = '';
                return;
            }

            loadingMessage.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            playerInfoOutput.innerHTML = ''; // Clear previous data

            try {
                const apiUrl = `${PLAYER_INFO_API_BASE}?uid=${uid}&region=${region}`;
                const response = await fetch(apiUrl);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                    throw new Error(`API Error: ${response.status} - ${errorData.message || response.statusText}`);
                }

                const data = await response.json();
                console.log('Fetched Data:', data); // Log the full data for debugging

                if (data.error) {
                    errorMessage.textContent = `Error: ${data.error}`;
                    errorMessage.classList.remove('hidden');
                } else if (data.AccountInfo && data.AccountInfo.AccountName) {
                    displayPlayerData(data);
                } else {
                    errorMessage.textContent = 'Player data not found or invalid response. Check UID and Region.';
                    errorMessage.classList.remove('hidden');
                }

            } catch (error) {
                console.error('Fetch error:', error);
                errorMessage.textContent = `Failed to fetch data: ${error.message}. Please check UID/Region or try again later.`;
                errorMessage.classList.remove('hidden');
            } finally {
                loadingMessage.classList.add('hidden');
            }
        }

        // Add event listener to the fetch button
        fetchBtn.addEventListener('click', fetchPlayerData);

        // Load app.json data and then fetch player data on initial load with default values
        loadAppItemsData().then(() => {
            fetchPlayerData();
        });
#!/bin/bash

# Create audio directory if it doesn't exist
mkdir -p assets/audio

# Download sound effects
curl -L "https://freesound.org/data/previews/131/131660_2337290-lq.mp3" -o assets/audio/beep.mp3
curl -L "https://freesound.org/data/previews/131/131660_2337290-lq.mp3" -o assets/audio/bell.mp3
curl -L "https://freesound.org/data/previews/131/131660_2337290-lq.mp3" -o assets/audio/whistle.mp3
curl -L "https://freesound.org/data/previews/131/131660_2337290-lq.mp3" -o assets/audio/countdown.mp3

# Make the script executable
chmod +x scripts/download_audio.sh 
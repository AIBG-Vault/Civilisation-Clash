_**About this template:**_

- _`agents/`: Example agents for testing out the topic._
- _`docs/`: Manuals and presentations._
- _`logic/`: Contains the game logic._
- _`server/`: Contains the server to which the agents connect to._
- _`visuals/`: Visualization files for the topic._

_**Regarding this README:**_

- _Replace all italicized placeholders with your actual content._
- _Remove any sections that are not relevant to your topic._
- _Keep instructions clear and concise._
- _Refer to the example READMEs in existing topics for formatting and level of detail._

# AIBG - _Topic_name_

_Replace with the name of your topic/game. Use a descriptive and unique title._

## Description

_Describe your topic/game in a couple of sentences. Explain the main idea, the objective, and what makes it interesting or unique. Mention the number of players, the type of gameplay, and any special mechanics._

## Visuals

_For visuals, simply add a few screenshots or gifs to showcase your topic:_

<p align="center">
  <img width="90%" src="https://pic.pnnet.dev/960x540" alt="AIBG - Topic"/>
  
  <img width="45%" src="https://pic.pnnet.dev/960x540" alt="AIBG - Topic"/>
  
  <img width="45%" src="https://pic.pnnet.dev/960x540" alt="AIBG - Topic"/>
  
  <img width="45%" src="https://pic.pnnet.dev/960x540" alt="AIBG - Topic"/>
  
  <img width="45%" src="https://pic.pnnet.dev/960x540" alt="AIBG - Topic"/>
</p>

## Docs

_List and link to topic manual and presentation:_

- [Topic manual](docs/AIBG%20-%20Topic%20manual%20-%20YourTopic.pdf)
- [Topic presentation](docs/AIBG%20-%20Topic%20presentation%20-%20YourTopic.pdf)

## Attribution

_Depending on your idea, you either started it from scratch or forked an existing repository in which case you need to link it:_

**Created by:**

- _Firstname Lastname_ _(Topic responsible)_
- _Firstname Lastname_

**Forked from [Original Repo](example.link), modified by:**

- _Firstname Lastname_ _(Topic responsible)_
- _Firstname Lastname_

## License [![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-cyan.svg

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

_Do not modify this section. All topics must use this license._

## Usage

This topic was used in the following events:

_List where and when this topic was used (e.g., at which AIBG event). List the event name, location, and date. Example:_

- [**Zagreb 05/2025** _(AIBG 9.0)_](https://best.hr/aibg/povijest/)

## How to run

Before you begin, make sure your environment is set up to run the game. The following prerequisites will help you configure your system to run the server, agents, and visuals correctly.

_Provide step-by-step instructions for running the topic locally. Include prerequisites, setup, and how to start the server, visuals, and agents. Use code blocks for commands. Make sure instructions are clear for someone new to the project._

### Prerequisites

_List all software and dependencies that need to be installed (e.g., Node.js, npm, Python, etc.). Specify versions if necessary. Provide installation commands and in what order._

### Game flow

_Explain the typical flow of a game round in steps. For example: starting the server, connecting agents, running visuals, and how the game shuts down._

### Running the server

1. Create a `players.json` file in the server directory using the example:

   ```bash
   cp players.json.example players.json
   ```

   - Edit player IDs and names in the newly created `players.json` as needed

2. Start the server:

_Describe how to set up and run the server with command-line options._

### Running the visuals

_Explain how to start the visualization (e.g., using Live Server in VS Code), and how to access it in the browser._

### Running agents

_Describe how to run the test agents you created._

## Deploy

_Provide instructions for deploying the topic on a remote server (e.g., VPS). Include installing prerequisites, copying files, installing dependencies, editing configuration, starting the server, and opening firewall ports. If your topic has any special deployment requirements (e.g., environment variables, extra services), mention them here. Also mention optional steps like setting up a custom domain if applicable._

# 10 Projets DevOps — Guide Complet

Tu as le code applicatif. C'est à TOI d'écrire les Dockerfile, les workflows GitHub Actions et les docker-compose.yml.
Ce guide t'explique TOUT : chaque commande, chaque bloc, pourquoi il est là.

---
---

# PARTIE 1 — COMPRENDRE DOCKER

---

## C'est quoi Docker ?

Docker emballe ton application + toutes ses dépendances dans une "boîte" (conteneur).
Cette boîte tourne de la même façon sur ta machine, sur GitHub Actions, sur AWS — partout.

Sans Docker : "ça marche sur ma machine mais pas en prod"
Avec Docker : "ça marche partout pareil"

---

## C'est quoi une image vs un conteneur ?

- **Image** = le plan de construction (comme une recette de cuisine). Elle ne bouge pas.
- **Conteneur** = une instance en cours d'exécution de l'image (comme le plat cuisiné). Tu peux lancer 10 conteneurs depuis 1 image.

```
Dockerfile  →  (docker build)  →  Image  →  (docker run)  →  Conteneur
```

---

## Les commandes Docker essentielles

### Construire une image
```bash
docker build -t nom-image:tag .
```
| Partie | Signification |
|--------|---------------|
| `docker build` | Commande pour construire une image |
| `-t nom-image:tag` | Donner un nom et un tag (version) à l'image |
| `.` | Le contexte de build (le dossier où se trouve le Dockerfile) |

Exemples :
```bash
docker build -t monapp:v1 .           # Image "monapp" version "v1"
docker build -t monapp:latest .       # "latest" = la dernière version
docker build -t jean/monapp:3 .       # "jean" = ton username Docker Hub
```

### Lancer un conteneur
```bash
docker run -d -p 8080:3000 --name mon-conteneur monapp:v1
```
| Flag | Signification |
|------|---------------|
| `-d` | Detached = en arrière-plan (tu gardes ton terminal) |
| `-p 8080:3000` | Port MACHINE:PORT_CONTENEUR — accès via localhost:8080 |
| `--name mon-conteneur` | Donner un nom au conteneur (sinon Docker en invente un) |
| `monapp:v1` | L'image à utiliser |

### Arrêter et supprimer
```bash
docker stop mon-conteneur        # Arrêter
docker rm mon-conteneur          # Supprimer
docker stop x && docker rm x     # Les 2 d'un coup
docker rm -f mon-conteneur       # Forcer l'arrêt + supprimer (raccourci)
```

### Voir ce qui tourne
```bash
docker ps                   # Conteneurs actifs
docker ps -a                # Tous les conteneurs (même arrêtés)
docker images               # Toutes les images
docker logs mon-conteneur   # Voir les logs (stdout) du conteneur
```

### Push vers Docker Hub
```bash
docker login                                    # Se connecter
docker tag monapp:v1 ton-username/monapp:v1     # Renommer pour Docker Hub
docker push ton-username/monapp:v1              # Envoyer
```

---

## Le Dockerfile — explication de CHAQUE instruction

Un Dockerfile est un fichier texte (sans extension) qui dit à Docker comment construire ton image.
Docker lit les instructions de HAUT en BAS.

### FROM — l'image de base
```dockerfile
FROM nginx:alpine
```
- Toujours la PREMIÈRE ligne
- C'est l'image sur laquelle tu te bases
- `nginx:alpine` = le serveur web nginx sur un Linux Alpine (très léger, ~5 Mo)
- `node:18-alpine` = Node.js version 18 sur Alpine
- `:alpine` = version légère. Sans ça, l'image pèse 3x plus lourd

**Pense à ça comme :** "Je pars d'un ordinateur qui a déjà nginx installé"

### WORKDIR — le dossier de travail
```dockerfile
WORKDIR /app
```
- Crée le dossier `/app` dans le conteneur ET se place dedans
- Toutes les commandes suivantes (COPY, RUN, CMD) s'exécutent DEPUIS ce dossier
- Comme faire `mkdir /app && cd /app`

**Pourquoi ?** Sans ça, tout se retrouve à la racine `/` — c'est le bordel.

### COPY — copier des fichiers
```dockerfile
COPY package.json ./
COPY . .
```
- `COPY source destination`
- `source` = chemin sur TA machine (relatif au dossier du Dockerfile)
- `destination` = chemin DANS le conteneur (relatif au WORKDIR)
- `./` = le dossier courant dans le conteneur (= WORKDIR = /app)
- `COPY . .` = copier TOUT le dossier local dans le conteneur

**Astuce importante — l'ORDRE :**
```dockerfile
COPY package.json ./        # ← change rarement
RUN npm install             # ← long mais mis en cache si package.json n'a pas changé
COPY server.js ./           # ← change souvent
```
Docker utilise un cache par couche. Si package.json n'a pas changé, Docker skip le `npm install`.
Si tu fais `COPY . .` d'un coup, le moindre changement dans server.js re-déclenche tout.

### RUN — exécuter une commande pendant le build
```dockerfile
RUN npm ci --only=production
RUN apk add --no-cache curl
```
- S'exécute pendant `docker build` (PAS au lancement du conteneur)
- Chaque RUN crée une nouvelle couche dans l'image
- Regroupe les commandes avec `&&` pour réduire les couches :
  ```dockerfile
  RUN apk add --no-cache curl && npm ci --only=production
  ```

**`npm ci` vs `npm install` :**
- `npm ci` = installe EXACTEMENT ce qui est dans package-lock.json (reproductible)
- `npm install` = peut mettre à jour des versions (non-déterministe)
- `--only=production` = n'installe PAS les devDependencies (image plus légère)

### EXPOSE — documenter le port
```dockerfile
EXPOSE 3000
```
- NE fait PAS le mapping de port ! C'est juste de la documentation.
- Dit "cette app écoute sur le port 3000"
- Le vrai mapping se fait avec `docker run -p 8080:3000`

### ENV — variable d'environnement
```dockerfile
ENV NODE_ENV=production
ENV PORT=3000
```
- Disponible au runtime (quand le conteneur tourne)
- L'app peut lire avec `process.env.NODE_ENV`

### ARG — variable de build
```dockerfile
ARG APP_VERSION=1.0.0
ENV APP_VERSION=${APP_VERSION}
```
- ARG = disponible UNIQUEMENT pendant le build
- Pour la passer : `docker build --build-arg APP_VERSION=2.0 .`
- Si tu veux qu'elle soit aussi dispo au runtime → la mettre dans un ENV

### USER — changer l'utilisateur
```dockerfile
USER node
```
- Par défaut, tout tourne en root (dangereux en prod)
- `USER node` = l'app tourne en tant qu'utilisateur "node" (moins de privilèges)
- Toujours le mettre APRÈS les RUN (qui ont besoin d'être root) et AVANT CMD

### CMD — commande de démarrage
```dockerfile
CMD ["node", "server.js"]
```
- LA commande qui se lance quand tu fais `docker run`
- Format JSON (avec les crochets) = recommandé
- Il n'y a qu'UN SEUL CMD par Dockerfile (le dernier gagne)
- Différence avec RUN : RUN = pendant le build, CMD = au lancement

### HEALTHCHECK — vérification de santé
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
```
| Option | Signification |
|--------|---------------|
| `--interval=30s` | Vérifier toutes les 30 secondes |
| `--timeout=3s` | Si pas de réponse en 3s → échec |
| `--start-period=5s` | Attendre 5s après le démarrage avant de checker |
| `--retries=3` | 3 échecs consécutifs → conteneur "unhealthy" |

---

## Multi-stage build — images optimisées

Un Dockerfile peut avoir PLUSIEURS `FROM`. Chaque FROM = une étape.
On copie uniquement le résultat utile d'une étape à l'autre.

```dockerfile
# ÉTAPE 1 : installer les dépendances (cette étape est jetée après)
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ÉTAPE 2 : image finale (légère)
FROM node:18-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server.js .
CMD ["node", "server.js"]
```

**Pourquoi ?**
- L'étape 1 peut avoir des outils de compilation (gcc, python) pour certains modules
- L'image finale ne garde QUE node_modules et le code
- Résultat : image 50-80% plus légère

`COPY --from=deps` = copier depuis l'étape nommée "deps" (pas depuis ta machine).

---
---

# PARTIE 2 — COMPRENDRE GITHUB ACTIONS

---

## C'est quoi GitHub Actions ?

GitHub Actions est l'outil d'automatisation intégré à GitHub. Il exécute des workflows quand tu fais un push, une pull request, un tag, ou manuellement.

Le flow :
```
Tu push sur GitHub → GitHub Actions détecte → exécute le workflow → résultat (succès/échec)
```

---

## C'est quoi un workflow GitHub Actions ?

Un workflow est un fichier YAML placé dans le dossier `.github/workflows/` de ton repository.

Avantage : ton pipeline est versionné avec ton code comme un workflow GitHub Actions, en YAML, et il est directement intégré à GitHub.

---

## Structure complète d'un workflow

```yaml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

---

## Explication de CHAQUE bloc

### `name`
```yaml
name: CI Pipeline
```
- Donne un nom visible dans l'interface GitHub Actions.
- Très utile pour retrouver rapidement un workflow.

### `on`
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```
- Déclenche le workflow automatiquement.
- Tu peux choisir `push`, `pull_request`, `workflow_dispatch`, `release`, `schedule`, etc.

### `jobs`
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
```
- Un workflow peut contenir plusieurs jobs.
- Chaque job tourne dans une machine GitHub Runner.
- `runs-on: ubuntu-latest` = la machine Ubuntu fournie par GitHub.

### `steps`
```yaml
steps:
  - uses: actions/checkout@v4
  - run: npm ci
```
- Les étapes s'exécutent dans l'ordre.
- `uses` = action déjà prête (comme `actions/checkout`).
- `run` = commande shell à exécuter.

### `env` — variables d'environnement
```yaml
env:
  IMAGE_NAME: jean/monapp
```
- Variables disponibles dans tout le workflow ou dans un job spécifique.
- Pour les secrets, utilise `secrets.DOCKERHUB_USERNAME` par exemple.

### `needs`
```yaml
jobs:
  test:
    runs-on: ubuntu-latest

  deploy:
    needs: test
    runs-on: ubuntu-latest
```
- Un job dépendant ne démarre que si les jobs précédents ont réussi.
- Très pratique pour faire un pipeline séquentiel.

### `strategy.matrix` — exécuter plusieurs variantes
```yaml
strategy:
  matrix:
    node-version: [18, 20]
```
- GitHub Actions peut lancer plusieurs variantes en parallèle.
- Très utile pour les tests multi-version ou les microservices.

### `if` — conditionner une étape ou un job
```yaml
if: github.ref == 'refs/heads/main'
```
- Exécute une étape seulement sous certaines conditions.
- Très pratique pour le deploy en production.

### Secrets GitHub
Dans GitHub → Settings → Secrets and variables → Actions → New repository secret.
Exemples :
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `EC2_HOST`
- `EC2_SSH_KEY`
- `SLACK_WEBHOOK`

Pour les utiliser dans le workflow :
```yaml
run: echo "Bonjour ${{ secrets.DOCKERHUB_USERNAME }}"
```

### Environnements protégés
GitHub permet de créer des environnements comme `staging` et `production` avec approbation manuelle.
C'est l'équivalent d'un "approval" dans Jenkins, mais intégré à GitHub.
- `sh(script: '...', returnStdout: true)` = exécute la commande ET récupère la sortie
- `.trim()` = enlève les espaces/retours à la ligne

### `parallel { }` — stages en parallèle
```groovy
stage('Build All') {
    parallel {
        stage('Service A') {
            steps { sh 'docker build ./service-a' }
        }
        stage('Service B') {
            steps { sh 'docker build ./service-b' }
        }
    }
}
```
- Les stages dans `parallel` s'exécutent EN MÊME TEMPS
- Plus rapide que de les faire un par un
- Si l'un échoue, les autres continuent mais le stage global échoue

### `post { }` — actions après le pipeline
```groovy
post {
    always {
        sh 'docker rm -f test-container || true'
        sh 'docker logout || true'
    }
    success {
        echo 'Déploiement réussi!'
    }
    failure {
        echo 'ERREUR - vérifier les logs'
    }
}
```

| Bloc | Quand il s'exécute |
|------|-------------------|
| `always` | TOUJOURS (succès ou échec) — pour nettoyer |
| `success` | Uniquement si tout a réussi |
| `failure` | Uniquement si quelque chose a échoué |

**Le `|| true` :** Si la commande échoue (conteneur n'existe pas), le `|| true` empêche que le post lui-même échoue. C'est un filet de sécurité pour le nettoyage.

### `input` — attendre une action humaine
```groovy
stage('Approval') {
    steps {
        input message: 'Déployer en production ?', ok: 'Deploy!'
    }
}
```
- Le pipeline se MET EN PAUSE
- Un bouton apparaît dans Jenkins
- Tu cliques "Deploy!" pour continuer ou "Abort" pour arrêter

### `sshagent` — se connecter en SSH
```groovy
sshagent(credentials: ['aws-ec2-ssh-key']) {
    sh '''
        ssh -o StrictHostKeyChecking=no ec2-user@${EC2_HOST} << EOF
            docker pull monapp:v1
            docker stop app || true
            docker rm app || true
            docker run -d --name app -p 80:3000 monapp:v1
EOF
    '''
}
```
- Utilise une clé SSH stockée dans Jenkins
- `<< EOF ... EOF` = "heredoc" — tout ce qui est entre les 2 EOF est exécuté SUR LE SERVEUR DISTANT
- `-o StrictHostKeyChecking=no` = ne pas demander "are you sure you want to connect?" (sinon Jenkins bloque)

---

## Variables Jenkins automatiques

Ces variables existent sans que tu les déclares :

| Variable | Valeur | Exemple |
|----------|--------|---------|
| `${BUILD_NUMBER}` | Numéro du build | 1, 2, 3, 42... |
| `${BUILD_URL}` | URL du build dans Jenkins | http://jenkins:8080/job/monjob/42/ |
| `${JOB_NAME}` | Nom du job | projet-01 |
| `${WORKSPACE}` | Chemin du dossier de travail | /var/jenkins_home/workspace/projet-01 |

---

## Credentials dans Jenkins

### Ajouter des credentials :
Jenkins → Manage Jenkins → Credentials → Global → Add Credentials

### Types :
| Type | Usage | Ce que tu récupères |
|------|-------|-------------------|
| Username with password | Docker Hub | `_USR` et `_PSW` |
| Secret text | Token, webhook URL | La valeur directement |
| SSH Username with private key | Clé SSH pour EC2 | Utilisé avec `sshagent()` |

### Utiliser les secrets GitHub Actions :
```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

### Exemple d'utilisation SSH avec GitHub Actions :
```yaml
- name: Deploy to EC2
  uses: appleboy/ssh-action@v1.0.0
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ec2-user
    key: ${{ secrets.EC2_SSH_KEY }}
    script: |
      docker pull myapp:latest
      docker run -d --name app -p 80:3000 myapp:latest
```

---
---

# PARTIE 3 — COMPRENDRE DOCKER COMPOSE

---

## C'est quoi Docker Compose ?

Quand ton app a besoin de PLUSIEURS services (app + base de données, app + redis, etc.),
docker-compose te permet de tout décrire dans UN fichier et tout lancer d'un coup.

Sans compose :
```bash
docker run -d --name redis redis:7
docker run -d --name app -p 3000:3000 --link redis monapp:v1
```

Avec compose :
```bash
docker-compose up -d      # Tout lance
docker-compose down       # Tout arrête
```

---

## Structure complète d'un docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    expose:
      - "6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

---

## Explication de CHAQUE clé

### `version: '3.8'`
- Version du format docker-compose (pas la version de ton app)
- '3.8' est la plus courante et récente pour compose v1
- Utilise toujours '3.8'

### `services:`
- La liste de tes conteneurs
- Chaque service = un conteneur qui sera lancé

### `build: .`
```yaml
app:
  build: .
```
- "Construis l'image depuis le Dockerfile dans le dossier `.`"
- Peut aussi être un sous-dossier : `build: ./api-gateway`
- Si tu utilises `build`, PAS besoin de `image`

### `image: redis:7-alpine`
```yaml
redis:
  image: redis:7-alpine
```
- "Utilise cette image existante (pas de build)"
- Pour les services qu'on ne modifie pas (bases de données, redis, etc.)

### `ports:`
```yaml
ports:
  - "3000:3000"      # host:conteneur
  - "8080:80"        # localhost:8080 → conteneur:80
```
- Rend le service accessible DEPUIS L'EXTÉRIEUR (ta machine, internet)
- Format : "PORT_MACHINE:PORT_CONTENEUR"

### `expose:`
```yaml
expose:
  - "3000"
```
- Rend le port accessible UNIQUEMENT aux autres services du compose
- PAS accessible depuis ta machine
- Utilise ça pour les services internes (base de données, redis)

### `environment:`
```yaml
environment:
  - REDIS_URL=redis://redis:6379
  - NODE_ENV=production
```
- Variables d'environnement injectées dans le conteneur
- L'app les lit avec `process.env.REDIS_URL`
- Format : `- NOM=valeur`

### Comment les services se trouvent entre eux ?
```yaml
services:
  app:
    environment:
      - REDIS_URL=redis://redis:6379    # "redis" = le nom du service
  redis:
    image: redis:7-alpine
```
- Docker Compose crée un réseau interne automatiquement
- Chaque service est accessible par SON NOM
- `app` peut joindre redis à l'adresse `redis:6379`
- C'est le nom sous `services:` qui devient le hostname

### `depends_on:`
```yaml
app:
  depends_on:
    - redis
```
- "Lance `redis` AVANT `app`"
- ATTENTION : ça garantit l'ORDRE de démarrage, pas que redis est PRÊT
- C'est pourquoi on met souvent un `sleep` ou un retry dans l'app

### `volumes:`
```yaml
services:
  redis:
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```
- Les données dans un conteneur sont PERDUES quand il est supprimé
- Un volume = stockage persistant qui survit à `docker-compose down`
- `redis-data:/data` = le volume "redis-data" est monté dans `/data` du conteneur
- Déclarer le volume en bas du fichier sous `volumes:`

### `restart:`
```yaml
restart: unless-stopped    # Redémarre sauf si arrêté manuellement
restart: always            # Redémarre TOUJOURS (même après reboot machine)
restart: "no"             # Ne redémarre jamais (défaut)
```

### `deploy:` — limites de ressources
```yaml
deploy:
  resources:
    limits:
      memory: 256M
      cpus: '0.5'
```
- Empêche un conteneur de consommer toute la RAM/CPU
- `256M` = max 256 Mo de RAM
- `'0.5'` = max 50% d'un CPU

---

## Commandes docker-compose

```bash
docker-compose up -d          # Construire (si build:) + lancer tout en arrière-plan
docker-compose up -d --build  # Forcer la reconstruction des images
docker-compose down           # Arrêter + supprimer les conteneurs
docker-compose down --volumes # + supprimer les volumes (données perdues)
docker-compose logs -f        # Voir les logs en temps réel
docker-compose logs app       # Logs d'un service spécifique
docker-compose ps             # Voir l'état des services
docker-compose build          # Construire sans lancer
docker-compose pull           # Télécharger les images (si image:)
```

---

## Variables d'environnement dans docker-compose

```yaml
services:
  app:
    image: ${IMAGE_NAME}:${TAG}
```

Tu passes les variables au moment du lancement :
```bash
IMAGE_NAME=jean/monapp TAG=v2 docker-compose up -d
# OU
export IMAGE_NAME=jean/monapp
export TAG=v2
docker-compose up -d
```

---
---

# PARTIE 4 — CONFIGURER GITHUB ACTIONS

---

## Créer un workflow

1. Dans ton repository GitHub, crée le dossier `.github/workflows/`
2. Ajoute un fichier YAML, par exemple `.github/workflows/projet01.yml`
3. Commit + push
4. Va dans l'onglet **Actions** de GitHub pour voir le workflow s'exécuter

---

## Configurer les secrets (étapes détaillées)

### 1. Accéder aux paramètres des secrets
- Depuis ton repo GitHub → **Settings** (en haut à droite)
- Clique sur **Secrets and variables** → **Actions** (colonne de gauche)

### 2. Créer chaque secret
Clique sur **New repository secret** et ajoute :

| Secret | Valeur | Projets | Comment l'obtenir |
|--------|--------|---------|-------------------|
| `DOCKERHUB_USERNAME` | Ton username Docker Hub | Tous | hub.docker.com → Account Settings |
| `DOCKERHUB_TOKEN` | Token d'accès (PAS ton mot de passe) | Tous | hub.docker.com → Account Settings → Security → New Access Token |
| `EC2_HOST` | IP publique ou DNS de prod | 07, 10 | AWS Console → EC2 → Instances → Public IPv4 |
| `STAGING_HOST` | IP publique ou DNS de staging | 08 | AWS Console → EC2 → Instances → Public IPv4 (machine staging) |
| `PRODUCTION_HOST` | IP publique ou DNS de prod | 08 | AWS Console → EC2 → Instances → Public IPv4 (machine prod) |
| `EC2_SSH_KEY` | Contenu du fichier `.pem` (la clé privée) | 07, 08, 10 | Le fichier `.pem` que tu as créé lors de la création de la clé EC2 |
| `SLACK_WEBHOOK` | URL du webhook Slack | 10 | Slack workspace → Apps → Incoming Webhooks → Add to Slack → copier l'URL |

### 3. Vérifier que les secrets sont créés
- Va dans **Secrets and variables** → **Actions**
- Tu dois voir une liste de secrets (maskés pour la sécurité)
- Pour utiliser un secret dans un workflow : `${{ secrets.DOCKERHUB_USERNAME }}`

### ⚠️ Bonnes pratiques
- NE JAMAIS mettre les secrets en dur dans le fichier YAML
- Les secrets sont toujours masqués dans les logs GitHub Actions
- Chaque secret peut être marqué comme "disponible pour les workflows publics" ou "privés uniquement"

---

## Ajouter des environnements protégés (Staging / Production)

### 1. Créer un environnement
- Settings → **Environments** → **New environment**
- Nomme-le `production` (ou `staging`)

### 2. Ajouter une règle d'approbation (optionnel)
Dans l'environnement `production` :
- Coche : **Required reviewers**
- Ajoute ton nom (ou un autre reviewer)
- Résultat : avant chaque déploiement en prod, tu dois approuver manuellement dans GitHub

### 3. Ajouter des secrets spécifiques à un environnement
Dans l'environnement `production` :
- Clique **Add secret**
- Ajoute les secrets qui sont UNIQUEMENT pour prod (ex: `PROD_EC2_HOST`)

### 4. Utiliser un environnement dans le workflow
```yaml
jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production      # ← Ça demande une approbation
    steps:
      - name: Deploy
        run: echo "Déploiement!"
```

Résultat :
- Tu pushes → le workflow démarre
- Arrivé au job `deploy-production`, GitHub met en pause et te demande d'approuver
- Seul toi (ou les reviewers) peux approuver
- Une fois approuvé, le déploiement continue

---

## Déclencher un workflow

### Sur push
```yaml
on:
  push:
    branches: [main]
```

### Sur pull request
```yaml
on:
  pull_request:
```

### Sur un tag
```yaml
on:
  push:
    tags:
      - 'v*'
```

### Manuellement
```yaml
on:
  workflow_dispatch:
```

Ce mode permet de lancer le workflow à la main dans l'onglet **Actions** → **Run workflow**.

### Sur webhook GitHub (automatique avec un push)
Avec GitHub Actions, tu n'as pas besoin de configurer un webhook externe : un push sur GitHub déclenche automatiquement le workflow.

---

## Utiliser un runner self-hosted

Si tu veux exécuter les workflows sur une vraie machine (par exemple ton serveur EC2 ou un serveur interne), tu peux ajouter un runner self-hosted.

Exemple :
```yaml
runs-on: self-hosted
```

C'est utile quand tu veux :
- accéder à Docker sur un serveur dédié
- faire des déploiements sur un host privé
- éviter les limites du runner GitHub cloud

### Installer un self-hosted runner
1. Settings → **Runners** (section Integrations)
2. Clique **New self-hosted runner**
3. Suis les instructions pour télécharger et configurer le runner sur ta machine
4. Une fois lancé, le runner apparaît dans la liste

---
---

# PARTIE 5 — LES 10 PROJETS (FICHIERS COMPLETS + EXPLICATIONS)

Chaque projet montre :
1. **Les fichiers COMPLETS** à écrire (copie-les tels quels)
2. **Les explications LIGNE PAR LIGNE** en dessous

---

## PROJET 01 — Build Docker Simple

### Objectif
Jenkins build une image Docker (site HTML + nginx) et vérifie que le conteneur démarre.

### Fichiers à créer
```
projet-01-html-basic/
├── index.html          ← (déjà fait)
└── Dockerfile         ← À TOI

.github/workflows/
└── projet01.yml       ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 80
```

### Explications ligne par ligne :

**Ligne 1 : `FROM nginx:alpine`**
- On part de l'image officielle nginx (serveur web)
- `:alpine` = version légère (~5 Mo au lieu de 130 Mo)
- Cette image a déjà nginx installé et configuré

**Ligne 2 : `COPY index.html /usr/share/nginx/html/index.html`**
- Copie TON fichier `index.html` dans le dossier que nginx sert par défaut
- `/usr/share/nginx/html/` = le dossier racine de nginx
- Quand quelqu'un visite le site, nginx sert ce fichier

**Ligne 3 : `EXPOSE 80`**
- Documente que nginx écoute sur le port 80
- Ne fait rien techniquement, mais informe les utilisateurs de l'image

---

### FICHIER : .github/workflows/projet01.yml

```yaml
name: Projet 01 - Build Docker

on:
  push:
    paths:
      - 'projet-01-html-basic/**'
      - '.github/workflows/projet01.yml'
  workflow_dispatch:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        working-directory: projet-01-html-basic
        run: docker build -t projet01:${{ github.sha }} .

      - name: Test container
        working-directory: projet-01-html-basic
        run: |
          docker run -d --name test-p01 -p 9001:80 projet01:${{ github.sha }}
          sleep 2
          curl -f http://localhost:9001 || exit 1
          docker rm -f test-p01
```

### Explications GitHub Actions :

- `on:` définit quand le workflow se déclenche. Ici, à chaque push dans le dossier du projet ou manuellement.
- `jobs:` contient les tâches à exécuter. Ici, un seul job `build-and-test`.
- `runs-on: ubuntu-latest` indique la machine GitHub qui exécutera le workflow.
- `actions/checkout@v4` télécharge ton code dans le runner.
- `working-directory` permet d'exécuter les commandes dans le sous-dossier du projet.
- `run:` exécute les commandes shell comme un mini script bash.
- `github.sha` est un identifiant unique du commit, très pratique pour tagger les images.

---

### Vérification locale (avant GitHub Actions)
```bash
cd projet-01-html-basic
docker build -t projet01:test .
docker run -d -p 9001:80 --name test01 projet01:test
curl http://localhost:9001        # → tu dois voir ton HTML
docker rm -f test01
```

---
---

## PROJET 02 — Build + Tests

### Objectif
Le pipeline exécute les tests. Si un test échoue → le pipeline s'arrête, pas de build.

### Fichiers à créer
```
projet-02-node-test/
├── package.json    ← (déjà fait)
├── server.js       ← (déjà fait)
├── test.js         ← (déjà fait)
└── Dockerfile      ← À TOI

.github/workflows/
└── projet02.yml    ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
COPY test.js .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Explications ligne par ligne :

**`FROM node:18-alpine`**
- Image de base avec Node.js version 18 sur Alpine Linux (léger)

**`WORKDIR /app`**
- Crée le dossier `/app` et s'y place
- Toutes les commandes suivantes s'exécutent depuis `/app`

**`COPY package*.json ./`**
- Copie `package.json` (et `package-lock.json` si il existe) dans `/app`
- Le `*` = wildcard, prend tous les fichiers qui matchent
- On copie ça EN PREMIER pour profiter du cache Docker (voir projet 01 Partie 1)

**`RUN npm ci --only=production`**
- Installe les dépendances Node.js
- `npm ci` = installation propre et reproductible (utilise package-lock.json)
- `--only=production` = n'installe PAS les devDependencies (image plus légère)
- Cette ligne est CACHÉE par Docker si package.json n'a pas changé → build rapide

**`COPY server.js .` et `COPY test.js .`**
- Copie les fichiers source dans le conteneur
- On les copie APRÈS npm ci pour que le cache fonctionne

**`EXPOSE 3000`**
- L'application écoute sur le port 3000

**`CMD ["node", "server.js"]`**
- Quand le conteneur démarre, il lance `node server.js`
- Format tableau (JSON) = recommandé par Docker

---

### FICHIER : .github/workflows/projet02.yml

```yaml
name: Projet 02 - Build + Tests

on:
  push:
    paths:
      - 'projet-02-node-test/**'
      - '.github/workflows/projet02.yml'
  workflow_dispatch:

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        working-directory: projet-02-node-test
        run: npm ci

      - name: Run tests
        working-directory: projet-02-node-test
        run: npm test

      - name: Build image
        working-directory: projet-02-node-test
        run: docker build -t projet02:${{ github.sha }} .

      - name: Verify container
        working-directory: projet-02-node-test
        run: |
          docker run -d --name test-p02 -p 4002:3000 projet02:${{ github.sha }}
          sleep 3
          curl -f http://localhost:4002/health || exit 1
          docker rm -f test-p02
```

### Explications GitHub Actions :

- `actions/setup-node@v4` prépare l'environnement Node.js sur le runner.
- Les étapes sont exécutées dans l'ordre. Si une étape échoue, le workflow s'arrête.
- `npm ci` et `npm test` correspondent aux étapes de validation avant construction de l'image.
- `docker build` n'est lancé qu'après les tests, ce qui évite de produire une image inutile en cas d'échec.
- `working-directory` évite d'avoir à changer de dossier dans chaque commande.

---

### Vérification locale
```bash
cd projet-02-node-test
npm install
npm test                          # → "TEST PASSED"
docker build -t projet02:test .
docker run -d -p 3002:3000 --name test02 projet02:test
curl http://localhost:3002/health  # → {"healthy":true}
docker rm -f test02
```

---
---

## PROJET 03 — Push vers Docker Hub

### Objectif
Après build + test, l'image est poussée automatiquement vers Docker Hub.

### Prérequis
Créer les secrets GitHub suivants : `DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN`.

### Fichiers à créer
```
projet-03-push-dockerhub/
├── package.json      ← (déjà fait)
├── server.js         ← (déjà fait)
├── Dockerfile        ← À TOI
└── .github/workflows/projet03.yml   ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Explications :
Identique au projet 02 mais SANS `COPY test.js .` (pas besoin du fichier de test dans l'image de production).

---

### FICHIER : .github/workflows/projet03.yml

```yaml
name: Projet 03 - Push Docker Hub

on:
  push:
    paths:
      - 'projet-03-push-dockerhub/**'
      - '.github/workflows/projet03.yml'
  workflow_dispatch:

jobs:
  build-test-push:
    runs-on: ubuntu-latest
    env:
      IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/projet03
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        working-directory: projet-03-push-dockerhub
        run: docker build -t $IMAGE_NAME:${{ github.sha }} .

      - name: Test container
        working-directory: projet-03-push-dockerhub
        run: |
          docker run -d --name test-p03 -p 4003:3000 $IMAGE_NAME:${{ github.sha }}
          sleep 2
          curl -f http://localhost:4003/health || exit 1
          docker rm -f test-p03

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Push image
        working-directory: projet-03-push-dockerhub
        run: |
          docker tag $IMAGE_NAME:${{ github.sha }} $IMAGE_NAME:latest
          docker push $IMAGE_NAME:${{ github.sha }}
          docker push $IMAGE_NAME:latest
```

### Explications GitHub Actions :

- `docker/login-action` est l'équivalent d'un login Docker sécurisé dans un pipeline.
- Les identifiants sont fournis via les secrets GitHub, pas en dur dans le fichier.
- `docker tag` crée un tag `latest` en plus du tag unique du commit.
- Les images sont publiées automatiquement au moment où le workflow passe.

---

### Vérification
Après le workflow GitHub Actions → va sur Docker Hub → tu dois voir les tags de ton image.

---
---

## PROJET 04 — Docker Compose (App + Redis)

### Objectif
L'app utilise Redis. Tout est décrit dans docker-compose. Jenkins lance, teste, nettoie.

### Fichiers à créer
```
projet-04-compose-services/
├── package.json           ← (déjà fait)
├── server.js              ← (déjà fait)
├── Dockerfile             ← À TOI
├── docker-compose.yml     ← À TOI
└── .github/workflows/
    └── projet04.yml       ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Explications :
Identique au projet 03 (app Node.js standard).

---

### FICHIER : docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
```

### Explications ligne par ligne :

**`version: '3.8'`**
- Version du format docker-compose (toujours mettre '3.8')

**`services:`**
- Début de la liste des conteneurs

**`app:`**
- Premier service, nommé "app"

**`build: .`**
- Construire l'image depuis le Dockerfile dans le dossier courant (`.`)
- docker-compose fait automatiquement `docker build .` pour ce service

**`ports: - "3000:3000"`**
- Port 3000 de ta machine → port 3000 du conteneur
- Tu accèdes à l'app via http://localhost:3000

**`environment: - REDIS_URL=redis://redis:6379`**
- Variable d'environnement injectée dans le conteneur "app"
- `redis://redis:6379` → "redis" ici = le NOM du service redis (ligne plus bas)
- Docker Compose crée un réseau interne : les services se trouvent par leur nom

**`depends_on: - redis`**
- Démarre le service "redis" AVANT le service "app"
- Note : ne garantit pas que redis est PRÊT, juste qu'il est LANCÉ

**`redis:`**
- Deuxième service, nommé "redis"

**`image: redis:7-alpine`**
- Pas de `build` → utilise l'image officielle Redis directement
- Redis version 7 sur Alpine Linux

---

### FICHIER : .github/workflows/projet04.yml

```yaml
name: Projet 04 - Docker Compose

on:
  push:
    paths:
      - 'projet-04-compose-services/**'
      - '.github/workflows/projet04.yml'
  workflow_dispatch:

jobs:
  compose-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build services
        working-directory: projet-04-compose-services
        run: docker compose build

      - name: Start services
        working-directory: projet-04-compose-services
        run: |
          docker compose up -d
          sleep 5

      - name: Integration tests
        working-directory: projet-04-compose-services
        run: |
          curl -f http://localhost:3000/health || exit 1
          curl -f http://localhost:3000/ || exit 1
          curl -f http://localhost:3000/ || exit 1

      - name: Cleanup
        if: always()
        working-directory: projet-04-compose-services
        run: docker compose down --volumes
```

### Explications GitHub Actions :

- `docker compose` est maintenant la forme moderne de Docker Compose, compatible avec les runners GitHub.
- L'étape `Cleanup` utilise `if: always()` pour nettoyer même si un test a échoué.
- L'intérêt du workflow est de tester l'ensemble de l'application en environnement conteneurisé, comme un vrai scénario d'intégration.

---

### Vérification locale
```bash
cd projet-04-compose-services
docker-compose up -d
sleep 3
curl http://localhost:3000/health   # → redis: connected
curl http://localhost:3000/          # → visits: 1
curl http://localhost:3000/          # → visits: 2
docker-compose down --volumes
```

---
---

## PROJET 05 — Multi-stage Build + Versioning

### Objectif
Image optimisée (plus légère) et version injectée dynamiquement au moment du build.

### Fichiers à créer
```
projet-05-multistage-env/
├── package.json    ← (déjà fait)
├── server.js       ← (déjà fait)
├── test.js         ← (déjà fait)
└── Dockerfile      ← À TOI

.github/workflows/
└── projet05.yml    ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY server.js .
ARG APP_VERSION=1.0.0
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### Explications ligne par ligne :

**`FROM node:18-alpine AS deps`**
- PREMIÈRE étape du multi-stage, nommée "deps"
- `AS deps` = donne un nom à cette étape pour y faire référence plus tard
- Cette étape sert UNIQUEMENT à installer les dépendances

**`WORKDIR /app` + `COPY package*.json ./` + `RUN npm ci --only=production`**
- Installe les dépendances dans cette étape temporaire
- Tout ce qui est installé ici est disponible via `COPY --from=deps`

**`FROM node:18-alpine`** (deuxième FROM)
- DEUXIÈME étape = l'image FINALE
- Repart de zéro (image propre)
- L'étape "deps" est jetée après (ne fait pas partie de l'image finale)

**`COPY --from=deps /app/node_modules ./node_modules`**
- Copie le dossier `node_modules` depuis l'étape "deps" vers l'image finale
- On ne prend QUE ce dont on a besoin
- Résultat : pas d'outils de build inutiles dans l'image finale

**`ARG APP_VERSION=1.0.0`**
- Déclare un argument de build
- Valeur par défaut : "1.0.0"
- On peut la changer avec `docker build --build-arg APP_VERSION=5.0.0`

**`ENV APP_VERSION=${APP_VERSION}`**
- Transforme l'ARG en variable d'environnement
- ARG = existe uniquement pendant le build
- ENV = existe au runtime (quand le conteneur tourne)
- L'app peut lire `process.env.APP_VERSION`

**`ENV NODE_ENV=production`**
- Dit à Node.js qu'on est en mode production
- Certains frameworks optimisent leur comportement en production

**`USER node`**
- Change l'utilisateur de root → node
- Sécurité : si l'app est compromise, l'attaquant a moins de privilèges
- L'image `node:alpine` a déjà un utilisateur "node" créé

---

### FICHIER : .github/workflows/projet05.yml

```yaml
name: Projet 05 - Multi-stage + Versioning

on:
  push:
    paths:
      - 'projet-05-multistage-env/**'
      - '.github/workflows/projet05.yml'
  workflow_dispatch:

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    env:
      IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/projet05
      APP_VERSION: ${{ github.run_number }}.0.0
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install and test
        working-directory: projet-05-multistage-env
        run: |
          npm ci
          npm test

      - name: Build image with version
        working-directory: projet-05-multistage-env
        run: |
          docker build \
            --build-arg APP_VERSION=${APP_VERSION} \
            -t $IMAGE_NAME:${APP_VERSION} \
            -t $IMAGE_NAME:latest \
            .

      - name: Test image response
        working-directory: projet-05-multistage-env
        run: |
          docker run -d --name test-p05 -p 4005:3000 $IMAGE_NAME:${APP_VERSION}
          sleep 2
          RESPONSE=$(curl -s http://localhost:4005/)
          echo "$RESPONSE" | grep -q "${APP_VERSION}" || exit 1
          docker rm -f test-p05

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Push image
        run: |
          docker push $IMAGE_NAME:${APP_VERSION}
          docker push $IMAGE_NAME:latest
```

### Explications GitHub Actions :

- `github.run_number` remplace le numéro de build Jenkins par un identifiant de run GitHub Actions.
- `build-arg` permet d'injecter une version au moment de la construction Docker.
- L'étape de test vérifie que la version est bien visible dans la réponse HTTP de l'application.
- Les images sont ensuite poussées sur Docker Hub avec un tag unique et un tag `latest`.

---

### Vérification locale
```bash
docker build --build-arg APP_VERSION=42.0.0 -t projet05:test .
docker run -d -p 3005:3000 --name test05 projet05:test
curl http://localhost:3005/      # → version: "42.0.0"
docker rm -f test05
```

---
---

## PROJET 06 — Webhook GitHub/GitLab (Auto-trigger)

### Objectif
Plus de "Build Now". Tu push → Jenkins build automatiquement.

### Fichiers à créer
```
projet-06-webhook-github/
├── package.json    ← (déjà fait)
├── server.js       ← (déjà fait)
├── test.js         ← (déjà fait)
└── Dockerfile      ← À TOI

.github/workflows/
└── projet06.yml    ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### Explications :
Identique aux projets précédents. Ajout de `USER node` pour la sécurité.

---

### FICHIER : .github/workflows/projet06.yml

```yaml
name: Projet 06 - Auto-trigger

on:
  push:
    branches: [main]
    paths:
      - 'projet-06-webhook-github/**'
      - '.github/workflows/projet06.yml'
  workflow_dispatch:

jobs:
  test-and-push:
    runs-on: ubuntu-latest
    env:
      IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/projet06
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install and test
        working-directory: projet-06-webhook-github
        run: |
          npm ci
          npm test

      - name: Build image
        working-directory: projet-06-webhook-github
        run: docker build -t $IMAGE_NAME:${{ github.sha }} .

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Push image
        run: |
          docker tag $IMAGE_NAME:${{ github.sha }} $IMAGE_NAME:latest
          docker push $IMAGE_NAME:${{ github.sha }}
          docker push $IMAGE_NAME:latest
```

### Explications GitHub Actions :

- Le workflow est déclenché automatiquement à chaque push sur la branche `main`.
- À la différence de Jenkins, tu n'as pas besoin de configurer un webhook manuel : GitHub le fait lui-même.
- La clause `paths` permet de limiter l'exécution au projet concerné et au workflow lui-même.

### Test :
```bash
echo "// v2" >> server.js
git add . && git commit -m "trigger test" && git push
# → GitHub Actions démarre automatiquement en quelques secondes
```

---
---

## PROJET 07 — Déploiement AWS EC2

### Objectif
Le pipeline déploie le conteneur sur un vrai serveur AWS après le push Docker Hub.

### Prérequis
1. Instance EC2 avec Docker installé
2. Secret SSH pour GitHub Actions (clé privée stockée dans `EC2_SSH_KEY`)

### Fichiers à créer
```
projet-07-deploy-aws/
├── package.json      ← (déjà fait)
├── server.js         ← (déjà fait)
├── Dockerfile        ← À TOI
└── .github/workflows/
    └── projet07.yml   ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

---

### FICHIER : .github/workflows/projet07.yml

```yaml
name: Projet 07 - Deploy AWS EC2

on:
  push:
    branches: [main]
    paths:
      - 'projet-07-deploy-aws/**'
      - '.github/workflows/projet07.yml'
  workflow_dispatch:

jobs:
  build-test-deploy:
    runs-on: ubuntu-latest
    env:
      IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/projet07
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        working-directory: projet-07-deploy-aws
        run: docker build -t $IMAGE_NAME:${{ github.sha }} .

      - name: Test container
        working-directory: projet-07-deploy-aws
        run: |
          docker run -d --name test-p07 -p 4007:3000 $IMAGE_NAME:${{ github.sha }}
          sleep 2
          curl -f http://localhost:4007/health || exit 1
          docker rm -f test-p07

      - name: Login Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Push image
        run: |
          docker tag $IMAGE_NAME:${{ github.sha }} $IMAGE_NAME:latest
          docker push $IMAGE_NAME:${{ github.sha }}
          docker push $IMAGE_NAME:latest

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            docker pull ${{ env.IMAGE_NAME }}:${{ github.sha }}
            docker stop app || true
            docker rm app || true
            docker run -d --name app -p 80:3000 --restart unless-stopped ${{ env.IMAGE_NAME }}:${{ github.sha }}
            sleep 3
            curl -f http://localhost/health
```

### Explications GitHub Actions :

- `appleboy/ssh-action` permet d'exécuter des commandes SSH sur ton EC2 de manière très simple.
- Les secrets `EC2_HOST` et `EC2_SSH_KEY` remplacent le credential Jenkins.
- L'image est poussée sur Docker Hub puis déployée sur l'EC2.
- `curl -f http://localhost/health` vérifie que l'application répond bien sur l'instance.

---

### Vérification
Ouvre `http://IP_EC2/` dans ton navigateur après le workflow.

---
---

## PROJET 08 — Staging → Approval → Production

### Objectif
2 environnements. Déployer en staging d'abord, attendre ton approbation, puis production.

### Fichiers à créer
```
projet-08-multi-env/
├── package.json                  ← (déjà fait)
├── server.js                     ← (déjà fait)
├── Dockerfile                    ← À TOI
├── docker-compose-staging.yml    ← À TOI
├── docker-compose-production.yml ← À TOI
└── .github/workflows/
    └── projet08.yml   ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

---

### FICHIER : docker-compose.staging.yml

```yaml
version: '3.8'

services:
  app:
    image: ${IMAGE_NAME}:${TAG}
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=staging
      - APP_VERSION=${TAG}
    restart: unless-stopped
```

### Explications :

**`image: ${IMAGE_NAME}:${TAG}`**
- Pas de `build:` → on utilise l'image déjà pushée sur Docker Hub
- Les variables `${IMAGE_NAME}` et `${TAG}` sont passées via l'environnement shell

**`ports: - "3000:3000"`**
- En staging, on utilise le port 3000 (pas le 80)
- Permet de tester sans impacter la production

**`NODE_ENV=staging`**
- L'app sait qu'elle tourne en staging (peut activer du debug, etc.)

**`restart: unless-stopped`**
- Redémarre automatiquement sauf si tu l'arrêtes manuellement

---

### FICHIER : docker-compose.production.yml

```yaml
version: '3.8'

services:
  app:
    image: ${IMAGE_NAME}:${TAG}
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - APP_VERSION=${TAG}
    restart: always
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'
```

### Explications des DIFFÉRENCES avec staging :

**`ports: - "80:3000"`**
- Port 80 = HTTP standard (les utilisateurs tapent juste http://monsite.com)

**`NODE_ENV=production`**
- Mode production (optimisations activées)

**`restart: always`**
- Redémarre TOUJOURS, même après un reboot du serveur (plus strict que `unless-stopped`)

**`deploy: resources: limits:`**
- Limite la RAM à 256 Mo et le CPU à 50%
- En production, on ne veut pas qu'un bug consomme toutes les ressources

---

### FICHIER : .github/workflows/projet08.yml

```yaml
name: Projet 08 - Staging + Production

on:
  push:
    branches: [main]
    paths:
      - 'projet-08-multi-env/**'
      - '.github/workflows/projet08.yml'
  workflow_dispatch:

jobs:
  build-test-push:
    runs-on: ubuntu-latest
    env:
      IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/projet08
      IMAGE_TAG: ${{ github.run_number }}-${{ github.sha }}
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        working-directory: projet-08-multi-env
        run: docker build -t $IMAGE_NAME:$IMAGE_TAG .

      - name: Test image
        working-directory: projet-08-multi-env
        run: |
          docker run -d --name test-p08 -p 4008:3000 -e NODE_ENV=test $IMAGE_NAME:$IMAGE_TAG
          sleep 2
          curl -f http://localhost:4008/health || exit 1
          docker rm -f test-p08

      - name: Login Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Push image
        run: |
          docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:latest
          docker push $IMAGE_NAME:$IMAGE_TAG
          docker push $IMAGE_NAME:latest

  deploy-staging:
    needs: build-test-push
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /app/projet-08
            docker pull ${{ secrets.DOCKERHUB_USERNAME }}/projet08:${{ github.run_number }}-${{ github.sha }}
            docker compose -f docker-compose-staging.yml down || true
            docker compose -f docker-compose-staging.yml pull
            docker compose -f docker-compose-staging.yml up -d
            sleep 3
            curl -f http://localhost:3000/health || exit 1

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /app/projet-08
            docker pull ${{ secrets.DOCKERHUB_USERNAME }}/projet08:${{ github.run_number }}-${{ github.sha }}
            docker compose -f docker-compose-production.yml down || true
            docker compose -f docker-compose-production.yml pull
            docker compose -f docker-compose-production.yml up -d
            sleep 3
            curl -f http://localhost:80/health || exit 1
```

### Explications GitHub Actions :

**Structure :**
- `needs` impose un ordre entre les jobs : build → staging → production.
- `environment: production` demande une approbation manuelle avant déploiement en prod.

**Utilisation de docker-compose :**
- Au lieu de `docker run` simple, on utilise `docker-compose -f docker-compose-staging.yml up -d`.
- Cela respecte les configurations définies dans les fichiers docker-compose spécifiques à chaque env.
- `docker-compose down` nettoie les conteneurs avant (pour éviter les conflits).
- `docker-compose pull` télécharge l'image la plus récente avant de lancer.

**Avantages :**
- Chaque environnement (staging/prod) a une configuration dédiée (ports, env vars, volumes).
- Facile à tester localement avec le même docker-compose.
- Plus maintenable qu'une longue commande `docker run` avec 10 paramètres.

---
---

## PROJET 09 — Microservices (3 services en parallèle)

### Objectif
Builder 3 services en parallèle, les tester ensemble, les déployer.

### Fichiers à créer
```
projet-09-microservices/
├── api-gateway/
│   ├── package.json       ← (déjà fait)
│   ├── server.js          ← (déjà fait)
│   └── Dockerfile         ← À TOI
├── user-service/
│   ├── package.json       ← (déjà fait)
│   ├── server.js          ← (déjà fait)
│   └── Dockerfile         ← À TOI
├── product-service/
│   ├── package.json       ← (déjà fait)
│   ├── server.js          ← (déjà fait)
│   └── Dockerfile         ← À TOI
└── docker-compose.yml     ← À TOI

.github/workflows/
└── projet09.yml           ← À TOI
```

---

### FICHIER : api-gateway/Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
EXPOSE 8080
USER node
CMD ["node", "server.js"]
```

### FICHIER : user-service/Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### FICHIER : product-service/Dockerfile

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

### Explications :
Les 3 Dockerfiles sont identiques sauf le port EXPOSE :
- api-gateway = 8080 (point d'entrée public)
- user-service et product-service = 3000 (services internes)

---

### FICHIER : docker-compose.yml

```yaml
version: '3.8'

services:
  gateway:
    build: ./api-gateway
    ports:
      - "8080:8080"
    depends_on:
      - user-service
      - product-service

  user-service:
    build: ./user-service
    expose:
      - "3000"

  product-service:
    build: ./product-service
    expose:
      - "3000"
```

### Explications ligne par ligne :

**`gateway:` avec `ports: - "8080:8080"`**
- Le gateway est le SEUL service accessible de l'extérieur
- Il reçoit les requêtes et les redirige vers les bons services internes

**`depends_on: [user-service, product-service]`**
- Le gateway a besoin des 2 autres services pour fonctionner
- Ils démarrent AVANT le gateway

**`user-service:` et `product-service:` avec `expose: - "3000"`**
- `expose` (pas `ports`) = accessible UNIQUEMENT par les autres services
- Pas accessible depuis ta machine directement
- Le gateway les atteint via `http://user-service:3000` et `http://product-service:3000`

---

### FICHIER : .github/workflows/projet09.yml

```yaml
name: Projet 09 - Microservices

on:
  push:
    branches: [main]
    paths:
      - 'projet-09-microservices/**'
      - '.github/workflows/projet09.yml'
  workflow_dispatch:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api-gateway, user-service, product-service]
    steps:
      - uses: actions/checkout@v4

      - name: Build ${{ matrix.service }}
        working-directory: projet-09-microservices/${{ matrix.service }}
        run: docker build -t ${{ matrix.service }}:${{ github.sha }} .

  integration-test:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start microservices
        working-directory: projet-09-microservices
        run: |
          docker compose up -d
          sleep 5

      - name: Verify routes
        working-directory: projet-09-microservices
        run: |
          curl -f http://localhost:8080/health || exit 1
          curl -f http://localhost:8080/users || exit 1
          curl -f http://localhost:8080/products || exit 1

      - name: Cleanup
        if: always()
        working-directory: projet-09-microservices
        run: docker compose down
```

### Explications GitHub Actions :

- `strategy.matrix` permet de construire les 3 services en parallèle, comme un `parallel` Jenkins.
- Chaque service a son propre job de build, mais le test d'intégration ne démarre qu'une fois les 3 builds réussis.
- C'est un bon exemple de pipeline modulaire et évolutif.

---
---

## PROJET 10 — Pipeline Complète (Boss Final)

### Objectif
Tout ensemble : test, build, scan sécu, push, deploy avec rollback automatique, notifications Slack.

### Fichiers à créer
```
projet-10-full-auto/
├── package.json      ← (déjà fait)
├── server.js         ← (déjà fait)
├── test.js           ← (déjà fait)
├── Dockerfile        ← À TOI
└── docker-compose.yml ← À TOI

.github/workflows/
└── projet10.yml      ← À TOI
```

---

### FICHIER : Dockerfile

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=deps /app/node_modules ./node_modules
COPY server.js .
ARG APP_VERSION=0.0.0
ENV APP_VERSION=${APP_VERSION}
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
USER node
CMD ["node", "server.js"]
```

### Explications des NOUVEAUTÉS par rapport au projet 05 :

**`RUN apk add --no-cache curl`**
- Installe curl dans l'image (Alpine ne l'a pas par défaut)
- Nécessaire pour le HEALTHCHECK qui utilise curl
- `--no-cache` = ne pas garder le cache APK (image plus légère)
- DOIT être AVANT `USER node` (il faut être root pour installer des packages)

**`HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \`**
**`    CMD curl -f http://localhost:3000/health || exit 1`**
- Docker vérifie automatiquement la santé du conteneur
- Toutes les 30 secondes, il fait un curl sur /health
- Si 3 échecs consécutifs → le conteneur est marqué "unhealthy"
- `--start-period=5s` = ne pas vérifier pendant les 5 premières secondes (laisser l'app démarrer)

---

### FICHIER : docker-compose.prod.yml

```yaml
version: '3.8'

services:
  app:
    image: ${IMAGE_NAME}:${TAG}
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - APP_VERSION=${TAG}
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.5'
```

### Explications :

**`healthcheck:` dans docker-compose**
- Même concept que HEALTHCHECK dans le Dockerfile
- Ici avec un intervalle de 10s (plus fréquent pour la prod)
- docker-compose peut redémarrer le conteneur si unhealthy

---

### FICHIER : .github/workflows/projet10.yml

```yaml
name: Projet 10 - Pipeline Complète

on:
  push:
    branches: [main]
    paths:
      - 'projet-10-full-auto/**'
      - '.github/workflows/projet10.yml'
  workflow_dispatch:

jobs:
  test-build-scan:
    runs-on: ubuntu-latest
    env:
      IMAGE_NAME: ${{ secrets.DOCKERHUB_USERNAME }}/projet10
      IMAGE_TAG: ${{ github.run_number }}-${{ github.sha }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install and test
        working-directory: projet-10-full-auto
        run: |
          npm ci
          npm test

      - name: Build image
        working-directory: projet-10-full-auto
        run: |
          docker build \
            --build-arg APP_VERSION=${IMAGE_TAG} \
            -t $IMAGE_NAME:${IMAGE_TAG} \
            -t $IMAGE_NAME:latest \
            .

      - name: Security scan
        run: |
          docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --exit-code 1 --severity HIGH,CRITICAL $IMAGE_NAME:${IMAGE_TAG} || echo "Vulns detected"

      - name: Test image
        working-directory: projet-10-full-auto
        run: |
          docker run -d --name test-p10 -p 4010:3000 $IMAGE_NAME:${IMAGE_TAG}
          sleep 3
          curl -f http://localhost:4010/health || exit 1
          curl -f http://localhost:4010/metrics || exit 1
          docker rm -f test-p10

      - name: Login Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Push image
        run: |
          docker push $IMAGE_NAME:${IMAGE_TAG}
          docker push $IMAGE_NAME:latest

  deploy-production:
    needs: test-build-scan
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to EC2 with Rollback
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            set -e
            echo "=== Sauvegarde de la version actuelle ==="
            CURRENT_IMAGE=$(docker ps --filter name=app --format "{{.Image}}" 2>/dev/null || echo "")
            echo "Version actuelle: $CURRENT_IMAGE"
            
            NEW_IMAGE="${{ secrets.DOCKERHUB_USERNAME }}/projet10:${{ github.run_number }}-${{ github.sha }}"
            echo "Nouvelle image: $NEW_IMAGE"
            
            echo "=== Telechargement ==="
            docker pull "$NEW_IMAGE"
            
            echo "=== Deploiement ==="
            docker stop app || true
            docker rm app || true
            docker run -d --name app -p 80:3000 --restart unless-stopped "$NEW_IMAGE"
            
            echo "=== Health checks (5 tentatives) ==="
            RETRIES=5
            COUNTER=0
            SUCCESS=false
            
            while [ $COUNTER -lt $RETRIES ]; do
              COUNTER=$((COUNTER + 1))
              echo "Tentative $COUNTER/$RETRIES"
              if curl -f http://localhost/health > /dev/null 2>&1; then
                echo "✓ OK - deploiement reussi!"
                SUCCESS=true
                break
              fi
              if [ $COUNTER -lt $RETRIES ]; then
                echo "  Echec, nouvelle tentative dans 3s..."
                sleep 3
              fi
            done
            
            if [ "$SUCCESS" = "true" ]; then
              exit 0
            fi
            
            echo "✗ TOUS les health checks echoues! ROLLBACK en cours..."
            docker stop app
            docker rm app
            
            if [ -n "$CURRENT_IMAGE" ] && [ "$CURRENT_IMAGE" != "" ]; then
              echo "Rollback vers: $CURRENT_IMAGE"
              docker run -d --name app -p 80:3000 --restart unless-stopped "$CURRENT_IMAGE"
              sleep 3
              
              if curl -f http://localhost/health > /dev/null 2>&1; then
                echo "✓ Rollback reussi - ancienne version operationnelle"
                exit 1
              else
                echo "✗ Rollback ECHOUE - application indisponible!"
                exit 1
              fi
            else
              echo "✗ Aucune version precedente pour rollback"
              exit 1
            fi

      - name: Slack notification - Success
        if: success()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} -H "Content-Type: application/json" -d '{"text":"✓ Deploiement reussi - Build #${{ github.run_number }} - ${{ github.actor }}"}' || true

      - name: Slack notification - Failure with Rollback
        if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} -H "Content-Type: application/json" -d '{"text":"✗ Deploiement echoue ou rollback effectue - Build #${{ github.run_number }}"}' || true
```

### Explications GitHub Actions :

**Structure :**
- Le workflow est divisé en deux jobs : `test-build-scan` puis `deploy-production`.
- `environment: production` demande une approbation manuelle avant le déploiement en production.

**Sécurité :**
- Trivy scan les images pour les vulnérabilités critiques.
- Les secrets (DOCKERHUB_USERNAME, EC2_SSH_KEY, SLACK_WEBHOOK) ne sont jamais exposés.
- Le déploiement EC2 est effectué via SSH avec une clé privée sécurisée.

**Rollback automatique :**
- **Avant** de déployer, on sauvegarde l'image actuellement en production.
- **Pendant** le déploiement, on lance la nouvelle image et on fait des health checks (5 tentatives).
- **Si** tous les health checks échouent (app ne répond pas), on arrête la nouvelle image.
- **Ensuite**, on **restaure automatiquement** l'ancienne version.
- **Résultat** : si un déploiement est cassé, l'app revient à la version précédente sans interruption de service.

**Notifications :**
- Si le déploiement réussit → notification Slack positive.
- Si le déploiement échoue ou rollback → notification Slack d'alerte avec le numéro du build.

---

### Vérification locale (partielle)
```bash
cd projet-10-full-auto
npm install && npm test
docker build --build-arg APP_VERSION=test-1 -t projet10:test .
docker run -d -p 3010:3000 --name test10 projet10:test
curl http://localhost:3010/health    # → healthy
curl http://localhost:3010/metrics   # → uptime, memory
curl http://localhost:3010/          # → version: "test-1"
docker rm -f test10
```

---
---

# PARTIE 5.5 — BONNES PRATIQUES GITHUB ACTIONS

---

## Structure et organisation

### 1. Nommer les workflows clairement
```yaml
name: Build and Deploy to Production  # Pas: "CI" ou "Deploy"
```

### 2. Organiser par dossier
```
.github/
  workflows/
    build.yml          # Tests et build commun
    deploy-staging.yml # Déploiement staging
    deploy-prod.yml    # Déploiement production
    security-scan.yml  # Scans de sécurité
```

### 3. Documenter le workflow
```yaml
name: Build Docker Image

# Description: Ce workflow teste, build et pousse une image Docker
# Déclencheurs: Push sur main, workflow_dispatch manuel
# Secrets requis: DOCKERHUB_USERNAME, DOCKERHUB_TOKEN

on:
  push:
    branches: [main]
```

---

## Sécurité

### 1. Utiliser les secrets pour TOUT ce qui est sensible
❌ **Mauvais** :
```yaml
  run: docker login -u jean -p monmotdepasse123
```

✅ **Bon** :
```yaml
  - uses: docker/login-action@v3
    with:
      username: ${{ secrets.DOCKERHUB_USERNAME }}
      password: ${{ secrets.DOCKERHUB_TOKEN }}
```

### 2. Utiliser des versions spécifiques pour les actions
❌ **Mauvais** :
```yaml
  uses: actions/checkout  # Utilise 'main' (instable)
```

✅ **Bon** :
```yaml
  uses: actions/checkout@v4  # Version fixe (plus sûr)
```

### 3. Limiter les permissions du workflow
```yaml
jobs:
  build:
    permissions:
      contents: read      # Peut lire le repo
      packages: write     # Peut écrire dans packages
      # N'a PAS accès aux secrets d'autres repos
```

### 4. Utiliser des environnements protégés pour la prod
```yaml
jobs:
  deploy-prod:
    environment: production  # Demande approbation manuelle
```

---

## Performance et efficacité

### 1. Mettre en cache les dépendances
```yaml
  - uses: actions/cache@v3
    with:
      path: node_modules
      key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
      restore-keys: ${{ runner.os }}-node-

  - run: npm ci  # Utilise le cache si disponible
```

### 2. Utiliser des jobs parallèles (strategy.matrix)
```yaml
strategy:
  matrix:
    service: [gateway, user-service, product-service]

steps:
  - run: docker build -t ${{ matrix.service }} ./$ {{ matrix.service }}
```

### 3. Arrêter rapidement en cas d'erreur
```yaml
steps:
  - run: |
      set -e  # Arrêter si une commande échoue
      npm ci
      npm test
      npm run build
```

### 4. Limiter les logs volumineux
```yaml
  - run: docker build --quiet -t monapp .  # --quiet réduit la sortie
```

---

## Logs et debugging

### 1. Ajouter des étapes de debug
```yaml
  - name: Debug info
    if: failure()  # Seulement si le workflow échoue
    run: |
      echo "Image name: $IMAGE_NAME"
      docker images
      docker ps -a
```

### 2. Utiliser des outputs pour communiquer entre jobs
```yaml
  build:
    outputs:
      image-tag: ${{ env.IMAGE_TAG }}
    steps:
      - run: echo "IMAGE_TAG=v1.2.3" >> $GITHUB_ENV

  deploy:
    needs: build
    env:
      IMAGE_TAG: ${{ needs.build.outputs.image-tag }}
    steps:
      - run: docker pull $IMAGE_TAG
```

### 3. Activer le debug mode (si besoin)
```bash
# Via les secrets GitHub:
# ACTIONS_STEP_DEBUG=true
# Ensuite les logs seront plus verbeux
```

---

## Rollback et récupération

### 1. Toujours sauvegarder la version actuelle
```bash
CURRENT=$(docker ps --filter name=app --format "{{.Image}}")
echo "Sauvegarde: $CURRENT"
```

### 2. Faire des health checks avec retry
```bash
for i in 1 2 3 4 5; do
  if curl -f http://localhost/health; then
    echo "✓ OK"
    exit 0
  fi
  sleep 3
done
echo "✗ Échec - ROLLBACK"
exit 1
```

### 3. Ne jamais supprimer l'ancienne image immédiatement
```bash
# Garder les 3 dernières images pour rollback
docker image prune -f --filter "until=168h"  # Garder les images de moins de 7 jours
```

---

## Notifications et monitoring

### 1. Notifier les failures
```yaml
  - name: Notify on failure
    if: failure()
    run: |
      curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
        -d '{"text":"Deploy failed: '${GITHUB_RUN_ID}'"}'
```

### 2. Créer des badges pour le repo
Dans ton README.md :
```markdown
![CI](https://github.com/ton-username/repo/workflows/CI/badge.svg)
```

### 3. Ajouter des résumés d'exécution
```yaml
  - name: Create job summary
    if: always()
    run: |
      echo "## Résumé du deploy" >> $GITHUB_STEP_SUMMARY
      echo "- Image: $IMAGE_NAME:$IMAGE_TAG" >> $GITHUB_STEP_SUMMARY
      echo "- Status: ${{ job.status }}" >> $GITHUB_STEP_SUMMARY
```

---

---

# PARTIE 6 — RÉSUMÉ ET AIDE

## Tableau récapitulatif

| # | Concepts appris | Difficulté |
|---|----------------|------------|
| 01 | Dockerfile basique, docker build/run, workflow GitHub Actions | Facile |
| 02 | Tests dans le pipeline, étapes séquentielles | Facile |
| 03 | Secrets GitHub, docker push, Docker Hub | Moyen |
| 04 | docker-compose, multi-services, tests d'intégration | Moyen |
| 05 | Multi-stage build, ARG/ENV, versioning | Moyen |
| 06 | Trigger automatique sur push, workflow GitHub Actions | Moyen |
| 07 | SSH, déploiement EC2, actions SSH | Difficile |
| 08 | Multi-env, approbation GitHub, docker-compose en prod | Difficile |
| 09 | Jobs en parallèle, microservices | Difficile |
| 10 | Rollback automatique, scan sécu, notifications, pipeline complète | Expert |

**Note:** Le projet 10 inclut maintenant un rollback automatique : si un health check échoue, il revient automatiquement à la version précédente.

## Erreurs fréquentes et solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| "Permission denied" docker.sock | Le runner GitHub Actions n'a pas accès à Docker | Vérifier les permissions du runner ou utiliser un self-hosted runner |
| "npm ci" échoue | Pas de package-lock.json | Utilise `npm install` à la place |
| Le workflow ne se déclenche pas | Le chemin ou la branche ne correspondent pas | Vérifier la section `on:` et les chemins `paths` |
| "Cannot connect to Docker daemon" | Docker pas démarré ou pas monté | Vérifier que Docker est disponible sur le runner |
| "Host key verification failed" | Première connexion SSH | Ajouter `-o StrictHostKeyChecking=no` ou vérifier la clé SSH |
| Image trop grosse | Pas de multi-stage, pas alpine | Utiliser `:alpine` et multi-stage build |
| "port already in use" | Un conteneur utilise déjà ce port | `docker rm -f` le conteneur qui bloque |

## Le flow complet quand tu maîtrises les 10 projets

```
Toi: git push
  → GitHub détecte le push
  → GitHub Actions lance le workflow
  → Exécute les tests
  → Build l'image Docker
  → Scan de sécurité
  → Push sur Docker Hub
  → SSH sur EC2 → pull + run
  → Health check (rollback si fail)
  → Notification Slack
= TOUT est automatique. Tu push, tu attends 2 minutes, c'est en prod.
```

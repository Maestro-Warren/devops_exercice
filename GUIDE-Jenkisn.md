# 10 Projets DevOps — Guide Complet

Tu as le code applicatif. C'est à TOI d'écrire les Dockerfile, Jenkinsfile et docker-compose.yml.
Ce guide t'explique TOUT : chaque commande, chaque bloc, pourquoi il est là.

---
---

# PARTIE 1 — COMPRENDRE DOCKER

---

## C'est quoi Docker ?

Docker emballe ton application + toutes ses dépendances dans une "boîte" (conteneur).
Cette boîte tourne de la même façon sur ta machine, sur Jenkins, sur AWS — partout.

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

Avantage : ton pipeline est versionné avec ton code, comme un Jenkinsfile, mais en YAML, et il est directement intégré à GitHub.

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

### Utiliser dans le Jenkinsfile :
```groovy
environment {
    // "dockerhub-creds" = l'ID que tu as choisi en créant le credential
    DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
}
// Ensuite dans un sh :
// ${DOCKERHUB_CREDENTIALS_USR} = username
// ${DOCKERHUB_CREDENTIALS_PSW} = password
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

## Configurer les secrets

GitHub → Settings → Secrets and variables → Actions

Ajoute les secrets suivants selon les projets :
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `EC2_HOST`
- `EC2_SSH_KEY`
- `SLACK_WEBHOOK`

### Pourquoi ?
- Les secrets ne sont jamais exposés dans les logs.
- C'est l'équivalent des credentials Jenkins, mais beaucoup plus simple.

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

### Manuellement
```yaml
on:
  workflow_dispatch:
```

### Sur webhook GitHub (push automatique)
Avec GitHub Actions, tu n'as pas besoin de configurer un webhook externe : un push sur GitHub déclenche automatiquement le workflow.

---

## Ajouter des environnements protégés

GitHub → Settings → Environments

Exemple :
- `staging`
- `production`

Tu peux demander une approbation manuelle avant le déploiement production.
C'est l'équivalent du `input` de Jenkins, mais plus propre et intégré à GitHub.

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
├── index.html        ← (déjà fait)
├── Dockerfile        ← À TOI
└── Jenkinsfile       ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    stages {
        stage('Build') {
            steps {
                echo 'Construction de l\'image Docker...'
                sh 'docker build -t projet01:${BUILD_NUMBER} .'
            }
        }

        stage('Test') {
            steps {
                echo 'Test: vérifier que le conteneur démarre...'
                sh '''
                    docker run -d --name test-p01 -p 9001:80 projet01:${BUILD_NUMBER}
                    sleep 2
                    curl -f http://localhost:9001 || exit 1
                    docker stop test-p01
                    docker rm test-p01
                '''
            }
        }
    }

    post {
        always {
            sh 'docker rm -f test-p01 || true'
        }
    }
}
```

### Explications ligne par ligne :

**`pipeline {`**
- Bloc obligatoire qui englobe tout le pipeline

**`agent any`**
- Exécuter sur n'importe quel agent Jenkins disponible

**`stage('Build') {`**
- Première étape : construire l'image Docker

**`sh 'docker build -t projet01:${BUILD_NUMBER} .'`**
- `docker build` = construit une image depuis le Dockerfile
- `-t projet01:${BUILD_NUMBER}` = nomme l'image "projet01" avec le numéro du build comme tag
- `.` = chercher le Dockerfile dans le dossier courant
- `${BUILD_NUMBER}` = variable Jenkins automatique (1, 2, 3...)

**`stage('Test') {`**
- Deuxième étape : vérifier que le conteneur fonctionne

**`docker run -d --name test-p01 -p 9001:80 projet01:${BUILD_NUMBER}`**
- `-d` = lance en arrière-plan
- `--name test-p01` = nomme le conteneur (pour le retrouver après)
- `-p 9001:80` = redirige le port 9001 de la machine vers le port 80 du conteneur
- Résultat : on peut accéder au site via http://localhost:9001

**`sleep 2`**
- Attendre 2 secondes que nginx démarre complètement

**`curl -f http://localhost:9001 || exit 1`**
- `curl` = fait une requête HTTP
- `-f` = retourne une erreur si le serveur répond un code d'erreur (404, 500...)
- `|| exit 1` = si curl échoue, le script retourne l'erreur 1 → Jenkins marque le stage en ÉCHEC

**`docker stop test-p01` puis `docker rm test-p01`**
- Arrête et supprime le conteneur de test (nettoyage)

**`post { always {`**
- S'exécute TOUJOURS, que le pipeline réussisse ou échoue

**`sh 'docker rm -f test-p01 || true'`**
- Force la suppression du conteneur de test
- `|| true` = si le conteneur n'existe déjà plus, ne pas échouer
- C'est un filet de sécurité au cas où le stage Test a échoué avant le nettoyage

---

### Vérification locale (avant Jenkins)
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
├── package.json      ← (déjà fait)
├── server.js         ← (déjà fait)
├── test.js           ← (déjà fait)
├── Dockerfile        ← À TOI
└── Jenkinsfile       ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                echo 'Exécution des tests...'
                sh 'npm test'
            }
        }

        stage('Build Image') {
            steps {
                sh 'docker build -t projet02:${BUILD_NUMBER} .'
            }
        }

        stage('Verify Container') {
            steps {
                sh '''
                    docker run -d --name test-p02 -p 4002:3000 projet02:${BUILD_NUMBER}
                    sleep 3
                    curl -f http://localhost:4002/health || exit 1
                    docker stop test-p02
                    docker rm test-p02
                '''
            }
        }
    }

    post {
        failure {
            echo 'Pipeline ECHOUE - vérifier les logs'
        }
        always {
            sh 'docker rm -f test-p02 || true'
        }
    }
}
```

### Explications ligne par ligne :

**`stage('Install') { sh 'npm ci' }`**
- Installe les dépendances sur l'agent Jenkins (pas dans Docker)
- Nécessaire pour que `npm test` fonctionne dans le stage suivant

**`stage('Test') { sh 'npm test' }`**
- Exécute la commande `test` définie dans package.json (= `node test.js`)
- Si test.js retourne exit code 1 (échec) → LE PIPELINE S'ARRÊTE ICI
- Les stages Build et Verify ne s'exécutent PAS si les tests échouent

**`stage('Build Image') { sh 'docker build -t projet02:${BUILD_NUMBER} .' }`**
- Construit l'image Docker seulement si les tests passent
- Tag = numéro du build Jenkins

**`stage('Verify Container')`**
- Lance le conteneur et vérifie que l'API /health répond
- Port 4002 sur la machine → port 3000 dans le conteneur
- `sleep 3` = attendre que Node.js démarre
- `curl -f http://localhost:4002/health` = vérifier la route /health

**`post { failure { echo '...' } }`**
- Affiche un message si n'importe quel stage a échoué
- Utile pour le diagnostic dans les logs Jenkins

**`post { always { sh 'docker rm -f test-p02 || true' } }`**
- Nettoie le conteneur de test quoi qu'il arrive

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
Créer le credential `dockerhub-creds` dans Jenkins (voir Partie 4).

### Fichiers à créer
```
projet-03-push-dockerhub/
├── package.json      ← (déjà fait)
├── server.js         ← (déjà fait)
├── Dockerfile        ← À TOI
└── Jenkinsfile       ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        IMAGE_NAME = 'TON_USERNAME/projet03'
    }

    stages {
        stage('Build') {
            steps {
                sh 'docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .'
                sh 'docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:latest'
            }
        }

        stage('Test') {
            steps {
                sh '''
                    docker run -d --name test-p03 -p 4003:3000 ${IMAGE_NAME}:${BUILD_NUMBER}
                    sleep 2
                    curl -f http://localhost:4003/health || exit 1
                    docker stop test-p03 && docker rm test-p03
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                sh '''
                    echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin
                    docker push ${IMAGE_NAME}:${BUILD_NUMBER}
                    docker push ${IMAGE_NAME}:latest
                '''
            }
        }
    }

    post {
        always {
            sh 'docker rm -f test-p03 || true'
            sh 'docker logout || true'
        }
    }
}
```

### Explications ligne par ligne :

**`environment {`**
- Bloc qui définit les variables pour tout le pipeline

**`DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')`**
- Récupère le credential nommé 'dockerhub-creds' depuis Jenkins
- Jenkins crée automatiquement 2 sous-variables :
  - `$DOCKERHUB_CREDENTIALS_USR` = ton username Docker Hub
  - `$DOCKERHUB_CREDENTIALS_PSW` = ton token/mot de passe

**`IMAGE_NAME = 'TON_USERNAME/projet03'`**
- Le nom complet de l'image sur Docker Hub
- REMPLACE `TON_USERNAME` par ton vrai username Docker Hub
- Format Docker Hub : `username/nom-image`

**`sh 'docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .'`**
- Construit l'image avec le tag = numéro du build
- Exemple : `jean/projet03:5`

**`sh 'docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:latest'`**
- Crée un DEUXIÈME tag "latest" pour la même image
- "latest" = convention pour dire "la version la plus récente"
- Résultat : 2 tags pointent vers la même image

**`echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin`**
- Se connecte à Docker Hub
- `echo ... |` = envoie le mot de passe via stdin (pas en argument de la commande)
- `--password-stdin` = lit le mot de passe depuis stdin
- POURQUOI ? Si tu fais `docker login -p MOT_DE_PASSE`, le mot de passe apparaît dans les logs Jenkins. Avec stdin, il est caché.

**`docker push ${IMAGE_NAME}:${BUILD_NUMBER}`**
- Envoie l'image sur Docker Hub avec le tag du build (ex: :5)

**`docker push ${IMAGE_NAME}:latest`**
- Envoie aussi le tag latest (ex: :latest)
- Résultat sur Docker Hub : 2 tags disponibles

**`sh 'docker logout || true'`**
- Se déconnecte de Docker Hub (sécurité)
- `|| true` = ne pas échouer si déjà déconnecté

---

### Vérification
Après le build Jenkins → va sur hub.docker.com → ton repo → tu dois voir les tags.

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
└── Jenkinsfile            ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    stages {
        stage('Build avec Compose') {
            steps {
                sh 'docker-compose build'
            }
        }

        stage('Démarrer les services') {
            steps {
                sh 'docker-compose up -d'
                sh 'sleep 5'
            }
        }

        stage('Tests d\'intégration') {
            steps {
                sh '''
                    curl -f http://localhost:3000/health || exit 1
                    echo "Health check OK"
                    curl -f http://localhost:3000/ || exit 1
                    curl -f http://localhost:3000/ || exit 1
                    RESPONSE=$(curl -s http://localhost:3000/)
                    echo "Response: $RESPONSE"
                '''
            }
        }
    }

    post {
        always {
            sh 'docker-compose down --volumes'
        }
    }
}
```

### Explications ligne par ligne :

**`sh 'docker-compose build'`**
- Construit les images de tous les services qui ont `build:` (ici, seulement "app")
- Redis n'est pas buildé car il utilise `image:`

**`sh 'docker-compose up -d'`**
- Lance TOUS les services en arrière-plan
- `-d` = detached mode
- Redis démarre en premier (grâce à depends_on), puis app

**`sh 'sleep 5'`**
- Attendre 5 secondes que Redis ET l'app soient complètement démarrés
- Redis a besoin d'un moment pour accepter les connexions

**`curl -f http://localhost:3000/health || exit 1`**
- Vérifie que l'app est connectée à Redis
- L'app renvoie `{"healthy": true, "redis": "connected"}` si tout va bien

**`curl -f http://localhost:3000/ || exit 1`** (appelé 2 fois)
- Appeler la route `/` qui incrémente un compteur dans Redis
- Si Redis ne fonctionne pas, cette route échoue
- L'appeler 2 fois vérifie que le compteur augmente (= Redis persiste les données)

**`RESPONSE=$(curl -s http://localhost:3000/)`**
- `-s` = silent (pas de barre de progression)
- `$()` = capture la sortie dans une variable
- `echo "Response: $RESPONSE"` = affiche dans les logs Jenkins pour debug

**`sh 'docker-compose down --volumes'`**
- Arrête et supprime TOUS les conteneurs
- `--volumes` = supprime aussi les volumes (données Redis)
- Important : sans ça, les données persistent entre les builds → tests pas propres

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
├── package.json      ← (déjà fait)
├── server.js         ← (déjà fait)
├── test.js           ← (déjà fait)
├── Dockerfile        ← À TOI
└── Jenkinsfile       ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        IMAGE_NAME = 'TON_USERNAME/projet05'
        APP_VERSION = "${BUILD_NUMBER}.0.0"
    }

    stages {
        stage('Test') {
            steps {
                sh 'npm ci'
                sh 'npm test'
            }
        }

        stage('Build avec version') {
            steps {
                sh '''
                    docker build \
                        --build-arg APP_VERSION=${APP_VERSION} \
                        -t ${IMAGE_NAME}:${APP_VERSION} \
                        -t ${IMAGE_NAME}:latest \
                        .
                '''
            }
        }

        stage('Test Image') {
            steps {
                sh '''
                    docker run -d --name test-p05 -p 4005:3000 ${IMAGE_NAME}:${APP_VERSION}
                    sleep 2
                    RESPONSE=$(curl -s http://localhost:4005/)
                    echo $RESPONSE | grep -q "${APP_VERSION}" || exit 1
                    echo "Version correcte dans la réponse"
                    docker stop test-p05 && docker rm test-p05
                '''
            }
        }

        stage('Push Docker Hub') {
            steps {
                sh '''
                    echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin
                    docker push ${IMAGE_NAME}:${APP_VERSION}
                    docker push ${IMAGE_NAME}:latest
                '''
            }
        }
    }

    post {
        always {
            sh 'docker rm -f test-p05 || true'
            sh 'docker logout || true'
        }
    }
}
```

### Explications ligne par ligne :

**`APP_VERSION = "${BUILD_NUMBER}.0.0"`**
- Crée une version dynamique basée sur le numéro de build
- Build 1 → "1.0.0", Build 5 → "5.0.0"
- Chaque build a une version UNIQUE

**`docker build --build-arg APP_VERSION=${APP_VERSION}`**
- Passe la version au Dockerfile pendant la construction
- Dans le Dockerfile, `ARG APP_VERSION` reçoit cette valeur
- Puis `ENV APP_VERSION=${APP_VERSION}` la rend disponible à l'app

**`-t ${IMAGE_NAME}:${APP_VERSION} -t ${IMAGE_NAME}:latest`**
- Donne 2 tags à la même image EN UNE SEULE commande
- Le `\` à la fin de chaque ligne = continuation (la commande est sur plusieurs lignes)

**`echo $RESPONSE | grep -q "${APP_VERSION}" || exit 1`**
- `grep -q` = cherche le texte silencieusement (quiet)
- Vérifie que la réponse JSON contient bien la version
- Si la version n'est pas trouvée → exit 1 → stage échoue
- Ça prouve que le `--build-arg` a bien fonctionné

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
├── package.json      ← (déjà fait)
├── server.js         ← (déjà fait)
├── test.js           ← (déjà fait)
├── Dockerfile        ← À TOI
└── Jenkinsfile       ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        IMAGE_NAME = 'TON_USERNAME/projet06'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            steps {
                sh 'npm ci'
                sh 'npm test'
            }
        }

        stage('Build') {
            steps {
                sh '''
                    docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .
                    docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Push') {
            steps {
                sh '''
                    echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin
                    docker push ${IMAGE_NAME}:${BUILD_NUMBER}
                    docker push ${IMAGE_NAME}:latest
                '''
            }
        }
    }

    post {
        success {
            echo "Build #${BUILD_NUMBER} pushée avec succès sur Docker Hub"
        }
        failure {
            echo "ECHEC du build #${BUILD_NUMBER}"
        }
        always {
            sh 'docker logout || true'
        }
    }
}
```

### Explications des NOUVEAUTÉS :

**`triggers { githubPush() }`**
- Dit à Jenkins : "lance ce pipeline quand GitHub envoie un webhook"
- Pour GitLab local, remplace par : `gitlab(triggerOnPush: true)`
- SANS ce bloc, tu dois cliquer "Build Now" manuellement

**`stage('Checkout') { steps { checkout scm } }`**
- Récupère le code depuis le repo Git
- `scm` = la source configurée dans le job Jenkins
- OBLIGATOIRE quand le pipeline est déclenché par webhook
- Sans ça, Jenkins n'a pas le code à builder

### Configuration du webhook (voir Partie 4 pour le détail) :
- GitHub : Settings → Webhooks → URL = `http://JENKINS:8080/github-webhook/`
- GitLab local : Settings → Webhooks → URL = `http://jenkins:8080/project/NOM-JOB`

### Test :
```bash
echo "// v2" >> server.js
git add . && git commit -m "trigger test" && git push
# → Jenkins démarre automatiquement en ~5 secondes
```

---
---

## PROJET 07 — Déploiement AWS EC2

### Objectif
Le pipeline déploie le conteneur sur un vrai serveur AWS après le push Docker Hub.

### Prérequis
1. Instance EC2 avec Docker installé
2. Credential SSH dans Jenkins (ID: `aws-ec2-ssh-key`)

### Fichiers à créer
```
projet-07-deploy-aws/
├── package.json      ← (déjà fait)
├── server.js         ← (déjà fait)
├── Dockerfile        ← À TOI
└── Jenkinsfile       ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        IMAGE_NAME = 'TON_USERNAME/projet07'
        EC2_HOST = 'EC2_PUBLIC_IP'
    }

    stages {
        stage('Build') {
            steps {
                sh 'docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .'
                sh 'docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:latest'
            }
        }

        stage('Test') {
            steps {
                sh '''
                    docker run -d --name test-p07 -p 4007:3000 ${IMAGE_NAME}:${BUILD_NUMBER}
                    sleep 2
                    curl -f http://localhost:4007/health || exit 1
                    docker stop test-p07 && docker rm test-p07
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                sh '''
                    echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin
                    docker push ${IMAGE_NAME}:${BUILD_NUMBER}
                    docker push ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Deploy to AWS EC2') {
            steps {
                sshagent(credentials: ['aws-ec2-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ec2-user@${EC2_HOST} << ENDSSH
                            docker pull ${IMAGE_NAME}:${BUILD_NUMBER}
                            docker stop app || true
                            docker rm app || true
                            docker run -d --name app -p 80:3000 --restart unless-stopped ${IMAGE_NAME}:${BUILD_NUMBER}
                            sleep 3
                            curl -f http://localhost/health
ENDSSH
                    '''
                }
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    sleep 5
                    curl -f http://${EC2_HOST}/health || exit 1
                    echo "Déploiement vérifié avec succès!"
                '''
            }
        }
    }

    post {
        failure {
            echo "ECHEC - Rollback potentiel nécessaire"
        }
        always {
            sh 'docker rm -f test-p07 || true'
            sh 'docker logout || true'
        }
    }
}
```

### Explications des NOUVEAUTÉS :

**`EC2_HOST = 'EC2_PUBLIC_IP'`**
- Remplace par l'IP publique de ton instance EC2
- Exemple : `EC2_HOST = '54.123.45.67'`

**`sshagent(credentials: ['aws-ec2-ssh-key']) {`**
- Active la clé SSH stockée dans Jenkins pour les commandes à l'intérieur
- Jenkins utilise cette clé pour se connecter à l'EC2 sans mot de passe

**`ssh -o StrictHostKeyChecking=no ec2-user@${EC2_HOST} << ENDSSH`**
- `ssh` = se connecter au serveur distant
- `-o StrictHostKeyChecking=no` = ne pas demander "voulez-vous faire confiance à ce serveur ?"
- `ec2-user` = l'utilisateur par défaut sur Amazon Linux
- `<< ENDSSH ... ENDSSH` = heredoc — tout ce qui est entre les 2 ENDSSH est exécuté SUR L'EC2

**`docker pull ${IMAGE_NAME}:${BUILD_NUMBER}`** (exécuté sur EC2)
- Télécharge la nouvelle image depuis Docker Hub

**`docker stop app || true` puis `docker rm app || true`**
- Arrête et supprime l'ancien conteneur (si il existe)
- `|| true` = ne pas échouer si c'est le premier déploiement (pas d'ancien conteneur)

**`docker run -d --name app -p 80:3000 --restart unless-stopped ${IMAGE_NAME}:${BUILD_NUMBER}`**
- Lance la nouvelle version
- `-p 80:3000` = port 80 (HTTP standard) → port 3000 de l'app
- `--restart unless-stopped` = si l'EC2 redémarre, Docker relance le conteneur

**`curl -f http://localhost/health`** (sur l'EC2)
- Vérifie que la nouvelle version fonctionne SUR le serveur

**`stage('Verify Deployment')` — `curl -f http://${EC2_HOST}/health`**
- Vérifie DEPUIS Jenkins que l'EC2 est accessible de l'extérieur
- Double vérification : localhost (sur EC2) + IP publique (depuis Jenkins)

---

### Vérification
Ouvrir `http://IP_EC2/` dans ton navigateur après le build.

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
├── docker-compose.staging.yml    ← À TOI
├── docker-compose.production.yml ← À TOI
└── Jenkinsfile                   ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        IMAGE_NAME = 'TON_USERNAME/projet08'
        STAGING_HOST = 'IP_STAGING'
        PRODUCTION_HOST = 'IP_PRODUCTION'
    }

    stages {
        stage('Build & Tag') {
            steps {
                script {
                    env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.IMAGE_TAG = "${BUILD_NUMBER}-${env.GIT_SHORT}"
                }
                sh '''
                    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    docker run -d --name test-p08 -p 4008:3000 \
                        -e NODE_ENV=test \
                        ${IMAGE_NAME}:${IMAGE_TAG}
                    sleep 2
                    curl -f http://localhost:4008/health || exit 1
                    docker stop test-p08 && docker rm test-p08
                '''
            }
        }

        stage('Push') {
            steps {
                sh '''
                    echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin
                    docker push ${IMAGE_NAME}:${IMAGE_TAG}
                    docker push ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Deploy Staging') {
            steps {
                sshagent(credentials: ['aws-ec2-ssh-key']) {
                    sh '''
                        scp docker-compose.staging.yml ec2-user@${STAGING_HOST}:~/docker-compose.yml
                        ssh ec2-user@${STAGING_HOST} << ENDSSH
                            export IMAGE_NAME=${IMAGE_NAME}
                            export TAG=${IMAGE_TAG}
                            docker-compose pull
                            docker-compose up -d
                            sleep 3
                            curl -f http://localhost:3000/health
ENDSSH
                    '''
                }
            }
        }

        stage('Approval Production') {
            steps {
                input message: 'Déployer en production ?', ok: 'Deploy!'
            }
        }

        stage('Deploy Production') {
            steps {
                sshagent(credentials: ['aws-ec2-ssh-key']) {
                    sh '''
                        scp docker-compose.production.yml ec2-user@${PRODUCTION_HOST}:~/docker-compose.yml
                        ssh ec2-user@${PRODUCTION_HOST} << ENDSSH
                            export IMAGE_NAME=${IMAGE_NAME}
                            export TAG=${IMAGE_TAG}
                            docker-compose pull
                            docker-compose up -d
                            sleep 3
                            curl -f http://localhost/health
ENDSSH
                    '''
                }
            }
        }
    }

    post {
        always {
            sh 'docker rm -f test-p08 || true'
            sh 'docker logout || true'
        }
    }
}
```

### Explications des NOUVEAUTÉS :

**`env.GIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()`**
- Récupère les 7 premiers caractères du commit hash
- Exemple : "a3f2b1c"
- `returnStdout: true` = capturer la sortie au lieu de juste l'exécuter
- `.trim()` = enlever le retour à la ligne

**`env.IMAGE_TAG = "${BUILD_NUMBER}-${env.GIT_SHORT}"`**
- Tag unique : "5-a3f2b1c" (numéro de build + hash git)
- Plus informatif que juste un numéro

**`scp docker-compose.staging.yml ec2-user@${STAGING_HOST}:~/docker-compose.yml`**
- `scp` = copie un fichier vers un serveur distant via SSH
- Envoie le fichier compose sur le serveur staging
- Le renomme `docker-compose.yml` (nom par défaut que docker-compose cherche)

**`export IMAGE_NAME=... export TAG=...`** (sur le serveur)
- Définit les variables d'environnement que docker-compose.yml utilise (les `${...}`)

**`docker-compose pull`** (sur le serveur)
- Télécharge la nouvelle image depuis Docker Hub

**`docker-compose up -d`** (sur le serveur)
- Lance (ou met à jour) le conteneur avec la nouvelle image

**`input message: 'Déployer en production ?', ok: 'Deploy!'`**
- LE PIPELINE SE MET EN PAUSE
- Dans l'interface Jenkins, un bouton "Deploy!" apparaît
- Tu vérifies que le staging fonctionne, puis tu cliques
- Si tu cliques "Abort" → le pipeline s'arrête, pas de déploiement en prod

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
├── docker-compose.yml     ← À TOI
└── Jenkinsfile            ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        REGISTRY = 'TON_USERNAME'
        EC2_HOST = 'EC2_PUBLIC_IP'
    }

    stages {
        stage('Build All Services') {
            parallel {
                stage('Build Gateway') {
                    steps {
                        sh 'docker build -t ${REGISTRY}/gateway:${BUILD_NUMBER} ./api-gateway'
                    }
                }
                stage('Build User Service') {
                    steps {
                        sh 'docker build -t ${REGISTRY}/user-service:${BUILD_NUMBER} ./user-service'
                    }
                }
                stage('Build Product Service') {
                    steps {
                        sh 'docker build -t ${REGISTRY}/product-service:${BUILD_NUMBER} ./product-service'
                    }
                }
            }
        }

        stage('Integration Test') {
            steps {
                sh '''
                    docker-compose up -d
                    sleep 5
                    curl -f http://localhost:8080/health || exit 1
                    curl -f http://localhost:8080/users || exit 1
                    curl -f http://localhost:8080/products || exit 1
                    echo "Tous les services répondent correctement"
                    docker-compose down
                '''
            }
        }

        stage('Push All') {
            steps {
                sh '''
                    echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin
                    docker push ${REGISTRY}/gateway:${BUILD_NUMBER}
                    docker push ${REGISTRY}/user-service:${BUILD_NUMBER}
                    docker push ${REGISTRY}/product-service:${BUILD_NUMBER}
                '''
            }
        }

        stage('Deploy to AWS') {
            steps {
                sshagent(credentials: ['aws-ec2-ssh-key']) {
                    sh '''
                        scp docker-compose.yml ec2-user@${EC2_HOST}:~/
                        ssh ec2-user@${EC2_HOST} << ENDSSH
                            export REGISTRY=${REGISTRY}
                            export TAG=${BUILD_NUMBER}
                            docker-compose pull
                            docker-compose up -d
                            sleep 5
                            curl -f http://localhost:8080/health
ENDSSH
                    '''
                }
            }
        }
    }

    post {
        always {
            sh 'docker-compose down || true'
            sh 'docker logout || true'
        }
    }
}
```

### Explications des NOUVEAUTÉS :

**`parallel {`** dans le stage Build
- Les 3 builds s'exécutent EN MÊME TEMPS
- Au lieu de : Gateway (30s) → User (30s) → Product (30s) = 90s
- On a : les 3 en parallèle = ~30s total
- Chaque sous-stage est indépendant

**`REGISTRY = 'TON_USERNAME'`**
- On utilise un préfixe commun pour les 3 images
- Les images seront : `username/gateway`, `username/user-service`, `username/product-service`

**`docker-compose up -d` dans Integration Test**
- Lance les 3 services ensemble pour tester qu'ils communiquent
- curl /health = le gateway lui-même fonctionne
- curl /users = le gateway atteint user-service
- curl /products = le gateway atteint product-service
- Si un des 3 échoue → le test d'intégration échoue

---
---

## PROJET 10 — Pipeline Complète (Boss Final)

### Objectif
Tout ensemble : test, build, scan sécu, push, deploy avec rollback automatique, notifications Slack.

### Fichiers à créer
```
projet-10-full-auto/
├── package.json            ← (déjà fait)
├── server.js               ← (déjà fait)
├── test.js                 ← (déjà fait)
├── Dockerfile              ← À TOI
├── docker-compose.prod.yml ← À TOI
└── Jenkinsfile             ← À TOI
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

### FICHIER : Jenkinsfile

```groovy
pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
        IMAGE_NAME = 'TON_USERNAME/projet10'
        EC2_HOST = 'EC2_PUBLIC_IP'
        SLACK_WEBHOOK = credentials('slack-webhook-url')
    }

    stages {
        stage('Preparation') {
            steps {
                script {
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.GIT_AUTHOR = sh(script: 'git log -1 --format=%an', returnStdout: true).trim()
                    env.GIT_MESSAGE = sh(script: 'git log -1 --format=%s', returnStdout: true).trim()
                    env.IMAGE_TAG = "${BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
                }
                echo "Build ${IMAGE_TAG} par ${env.GIT_AUTHOR}: ${env.GIT_MESSAGE}"
            }
        }

        stage('Test') {
            steps {
                sh 'npm ci'
                sh 'npm test'
            }
        }

        stage('Build') {
            steps {
                sh '''
                    docker build \
                        --build-arg APP_VERSION=${IMAGE_TAG} \
                        -t ${IMAGE_NAME}:${IMAGE_TAG} \
                        -t ${IMAGE_NAME}:latest \
                        .
                '''
            }
        }

        stage('Security Scan') {
            steps {
                sh '''
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        aquasec/trivy image --exit-code 1 --severity HIGH,CRITICAL \
                        ${IMAGE_NAME}:${IMAGE_TAG} || echo "Vulnérabilités détectées (non-bloquant)"
                '''
            }
        }

        stage('Test Image') {
            steps {
                sh '''
                    docker run -d --name test-p10 -p 4010:3000 ${IMAGE_NAME}:${IMAGE_TAG}
                    sleep 3
                    curl -f http://localhost:4010/health || exit 1
                    curl -f http://localhost:4010/metrics || exit 1
                    echo "Image testée avec succès"
                    docker stop test-p10 && docker rm test-p10
                '''
            }
        }

        stage('Push to Docker Hub') {
            steps {
                sh '''
                    echo $DOCKERHUB_CREDENTIALS_PSW | docker login -u $DOCKERHUB_CREDENTIALS_USR --password-stdin
                    docker push ${IMAGE_NAME}:${IMAGE_TAG}
                    docker push ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Deploy to Production') {
            steps {
                sshagent(credentials: ['aws-ec2-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ec2-user@${EC2_HOST} << 'ENDSSH'
                            CURRENT=$(docker ps --format '{{.Image}}' --filter name=app | head -1)
                            echo "$CURRENT" > /tmp/previous-version.txt

                            export IMAGE_NAME=''' + env.IMAGE_NAME + '''
                            export TAG=''' + env.IMAGE_TAG + '''
                            docker pull ${IMAGE_NAME}:${TAG}
                            docker stop app || true
                            docker rm app || true
                            docker run -d --name app \
                                -p 80:3000 \
                                -e NODE_ENV=production \
                                -e APP_VERSION=${TAG} \
                                --restart unless-stopped \
                                ${IMAGE_NAME}:${TAG}

                            sleep 5
                            for i in 1 2 3 4 5; do
                                if curl -f http://localhost/health; then
                                    echo "Health check $i/5 OK"
                                else
                                    echo "Health check $i/5 ECHEC - ROLLBACK"
                                    docker stop app && docker rm app
                                    PREV=$(cat /tmp/previous-version.txt)
                                    docker run -d --name app -p 80:3000 --restart unless-stopped $PREV
                                    exit 1
                                fi
                                sleep 2
                            done
                            echo "Déploiement réussi!"
ENDSSH
                    '''
                }
            }
        }

        stage('Smoke Test Production') {
            steps {
                sh '''
                    sleep 5
                    RESPONSE=$(curl -s http://${EC2_HOST}/)
                    echo "Production response: $RESPONSE"
                    echo $RESPONSE | grep -q "${IMAGE_TAG}" || exit 1
                    echo "Version correcte en production!"
                '''
            }
        }
    }

    post {
        success {
            sh '''
                curl -X POST ${SLACK_WEBHOOK} \
                    -H "Content-Type: application/json" \
                    -d '{"text": "Deploiement reussi! Version: '"${IMAGE_TAG}"' Auteur: '"${GIT_AUTHOR}"'"}' || true
            '''
        }
        failure {
            sh '''
                curl -X POST ${SLACK_WEBHOOK} \
                    -H "Content-Type: application/json" \
                    -d '{"text": "ECHEC deploiement! Build: #'"${BUILD_NUMBER}"' Verifier: '"${BUILD_URL}"'"}' || true
            '''
        }
        always {
            sh 'docker rm -f test-p10 || true'
            sh 'docker logout || true'
        }
    }
}
```

### Explications COMPLÈTES ligne par ligne :

---

**STAGE : Preparation**

**`env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()`**
- `git rev-parse --short HEAD` = hash court du dernier commit (ex: "a3f2b1c")
- `returnStdout: true` = capturer le résultat dans une variable
- `.trim()` = enlever le retour à la ligne à la fin

**`env.GIT_AUTHOR = sh(script: 'git log -1 --format=%an', returnStdout: true).trim()`**
- `git log -1 --format=%an` = nom de l'auteur du dernier commit
- `-1` = seulement le dernier commit
- `%an` = author name

**`env.GIT_MESSAGE = sh(script: 'git log -1 --format=%s', returnStdout: true).trim()`**
- `%s` = subject (le message du commit)

**`env.IMAGE_TAG = "${BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"`**
- Tag final : "5-a3f2b1c" (unique et traçable)

---

**STAGE : Security Scan**

**`docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image ...`**
- Lance Trivy (scanner de vulnérabilités) dans un conteneur temporaire
- `--rm` = supprimer le conteneur Trivy après utilisation
- `-v /var/run/docker.sock:/var/run/docker.sock` = donne accès à Docker pour scanner l'image
- `--exit-code 1` = retourne erreur si vulnérabilités trouvées
- `--severity HIGH,CRITICAL` = ne cherche que les vulnérabilités graves
- `|| echo "..."` = si Trivy trouve des failles, on affiche un warning mais on NE BLOQUE PAS

---

**STAGE : Deploy to Production (ROLLBACK)**

**`CURRENT=$(docker ps --format '{{.Image}}' --filter name=app | head -1)`**
- Récupère le nom de l'image ACTUELLEMENT en cours d'exécution
- `--format '{{.Image}}'` = n'affiche que le nom de l'image
- `--filter name=app` = seulement le conteneur nommé "app"
- Exemple de résultat : "jean/projet10:4-b2c3d4e"

**`echo "$CURRENT" > /tmp/previous-version.txt`**
- Sauvegarde le nom de l'image actuelle dans un fichier
- Si le déploiement échoue, on pourra revenir à cette version

**`for i in 1 2 3 4 5; do ... done`**
- Boucle de 5 vérifications de santé
- Si les 5 passent → déploiement réussi
- Si UNE SEULE échoue → ROLLBACK

**Bloc ROLLBACK :**
```bash
docker stop app && docker rm app           # Arrêter la nouvelle version défaillante
PREV=$(cat /tmp/previous-version.txt)      # Lire l'ancienne version
docker run -d --name app ... $PREV         # Relancer l'ancienne version
exit 1                                      # Signaler l'échec à Jenkins
```
- Automatique : pas besoin d'intervention humaine
- L'ancienne version est remise en place en quelques secondes

---

**POST : Notifications Slack**

**`curl -X POST ${SLACK_WEBHOOK} -H "Content-Type: application/json" -d '{"text": "..."}'`**
- Envoie un message à un channel Slack via webhook
- `-X POST` = méthode HTTP POST
- `-H "Content-Type: application/json"` = on envoie du JSON
- `-d '{"text": "..."}' ` = le message
- `|| true` = ne pas échouer si Slack est inaccessible

**Comment obtenir le SLACK_WEBHOOK :**
1. Slack → Apps → Incoming Webhooks → Add to Slack
2. Choisir un channel
3. Copier l'URL (ressemble à https://hooks.slack.com/services/T.../B.../xxx)
4. Jenkins → Credentials → Secret text → ID: `slack-webhook-url`

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

# PARTIE 6 — RÉSUMÉ ET AIDE

## Tableau récapitulatif

| # | Concepts appris | Difficulté |
|---|----------------|------------|
| 01 | Dockerfile basique, docker build/run, Jenkinsfile 2 stages | Facile |
| 02 | Tests dans le pipeline, stages séquentiels | Facile |
| 03 | Credentials Jenkins, docker push, Docker Hub | Moyen |
| 04 | docker-compose, multi-services, tests d'intégration | Moyen |
| 05 | Multi-stage build, ARG/ENV, versioning | Moyen |
| 06 | Webhook GitHub, trigger automatique | Moyen |
| 07 | SSH, déploiement EC2, sshagent | Difficile |
| 08 | Multi-env, approval, docker-compose en prod | Difficile |
| 09 | Builds parallèles, microservices | Difficile |
| 10 | Rollback, scan sécu, notifications, pipeline complète | Expert |

## Erreurs fréquentes et solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| "Permission denied" docker.sock | Jenkins n'a pas accès à Docker | `chmod 666 /var/run/docker.sock` |
| "npm ci" échoue | Pas de package-lock.json | Utilise `npm install` à la place |
| Webhook ne trigger pas | URL incorrecte ou Jenkins pas accessible | Vérifier le / final, utiliser ngrok si local |
| "Cannot connect to Docker daemon" | Docker pas démarré ou pas monté | Vérifier le volume docker.sock dans compose Jenkins |
| "Host key verification failed" | Première connexion SSH | Ajouter `-o StrictHostKeyChecking=no` |
| Image trop grosse | Pas de multi-stage, pas alpine | Utiliser `:alpine` et multi-stage build |
| "port already in use" | Un conteneur utilise déjà ce port | `docker rm -f` le conteneur qui bloque |

## Le flow complet quand tu maîtrises les 10 projets

```
Toi: git push
  → GitHub envoie webhook à Jenkins
  → Jenkins pull le code
  → Exécute les tests
  → Build l'image Docker
  → Scan de sécurité
  → Push sur Docker Hub
  → SSH sur EC2 → pull + run
  → Health check (rollback si fail)
  → Notification Slack
= TOUT est automatique. Tu push, tu attends 2 minutes, c'est en prod.
```

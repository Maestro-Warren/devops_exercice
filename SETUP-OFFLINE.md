# Setup Hors Ligne — GitLab + Jenkins

Tout tourne en local. Zéro internet nécessaire après le premier pull.

---

## ÉTAPE 1 — Télécharger les images (UNE SEULE FOIS, avec internet)

```bash
docker pull gitlab/gitlab-ce:latest
docker pull jenkins/jenkins:lts
docker pull node:18-alpine
docker pull nginx:alpine
docker pull redis:7-alpine
```

Après ça, tu n'as PLUS JAMAIS besoin d'internet.

### Si tu veux copier les images depuis une autre machine :
```bash
# Sur la machine avec internet :
docker save gitlab/gitlab-ce:latest | gzip > gitlab.tar.gz
docker save jenkins/jenkins:lts | gzip > jenkins.tar.gz
docker save node:18-alpine | gzip > node.tar.gz
docker save nginx:alpine | gzip > nginx.tar.gz
docker save redis:7-alpine | gzip > redis.tar.gz

# Copier les fichiers .tar.gz sur clé USB...

# Sur ta machine sans internet :
docker load < gitlab.tar.gz
docker load < jenkins.tar.gz
docker load < node.tar.gz
docker load < nginx.tar.gz
docker load < redis.tar.gz
```

---

## ÉTAPE 2 — Lancer GitLab + Jenkins

```bash
cd ~/devops-exercices
docker-compose up -d
```

Attendre 3-5 minutes (GitLab est lent au premier démarrage).

Vérifier que tout tourne :
```bash
docker ps
# Tu dois voir 2 conteneurs : gitlab et jenkins
```

---

## ÉTAPE 3 — Configurer GitLab

### Récupérer le mot de passe root :
```bash
docker exec gitlab cat /etc/gitlab/initial_root_password
```

### Se connecter :
- Ouvrir http://localhost dans ton navigateur
- Username : `root`
- Password : celui de la commande ci-dessus
- CHANGE LE MOT DE PASSE immédiatement (il expire en 24h)

### Créer ton premier projet :
1. "New Project" → "Create blank project"
2. Nom : `projet-01`
3. Visibility : Private
4. Décocher "Initialize with README"
5. Create

---

## ÉTAPE 4 — Configurer Jenkins

### Premier accès :
```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

- Ouvrir http://localhost:8080
- Coller le mot de passe
- Choisir "Select plugins to install"

### Plugins à installer (IMPORTANT — certains sont hors ligne) :

Si tu n'as pas internet au moment de l'install Jenkins, tu peux skip les plugins
et les installer manuellement après (voir section "Plugins hors ligne" en bas).

Si tu as internet juste pour cette étape, installe :
- Git
- Pipeline
- Docker Pipeline
- GitLab Plugin
- SSH Agent
- Credentials Binding

### Créer un utilisateur admin :
- Username : admin
- Password : ce que tu veux
- Finish

---

## ÉTAPE 5 — Connecter Jenkins à GitLab

### Le problème :
Jenkins et GitLab sont dans Docker. Ils se trouvent par leur NOM DE SERVICE.
- Jenkins accède à GitLab via : `http://gitlab/root/projet-01.git`
- PAS `http://localhost/...` (localhost dans Jenkins = Jenkins lui-même)

### Ajouter le credential GitLab dans Jenkins :
1. Jenkins → Manage Jenkins → Credentials → Global → Add
2. Type : **Username with password**
3. ID : `gitlab-creds`
4. Username : `root`
5. Password : ton mot de passe GitLab

### Créer un job Pipeline :
1. New Item → Pipeline → nom "projet-01"
2. Pipeline → Definition : "Pipeline script from SCM"
3. SCM : Git
4. Repository URL : `http://gitlab/root/projet-01.git`
5. Credentials : sélectionner `gitlab-creds`
6. Branch : `*/main`
7. Script Path : `Jenkinsfile`
8. Save

---

## ÉTAPE 6 — Pousser du code vers GitLab local

```bash
cd ~/devops-exercices/projet-01-html-basic
git init
git add .
git commit -m "initial commit"
git remote add origin http://localhost/root/projet-01.git
git push -u origin main
# Username: root
# Password: ton mot de passe
```

### Pour ne plus taper le mot de passe :
```bash
git config --global credential.helper store
```

---

## ÉTAPE 7 — Webhook (GitLab déclenche Jenkins automatiquement)

### Autoriser les requêtes locales dans GitLab :
1. http://localhost → Admin Area (icône clé en haut)
2. Settings → Network → Outbound requests
3. Cocher : **"Allow requests to the local network from webhooks and integrations"**
4. Save

### Ajouter le webhook dans le projet GitLab :
1. Projet → Settings → Webhooks
2. URL : `http://jenkins:8080/project/projet-01`
3. Trigger : Push events ✓
4. SSL verification : DÉCOCHER
5. Add webhook
6. Cliquer "Test" → "Push events" pour vérifier

### Dans le Jenkinsfile, le trigger :
```groovy
triggers {
    gitlab(triggerOnPush: true)
}
```

---

## ÉTAPE 8 — Où sont les images Docker (sans Docker Hub) ?

Sans internet, tu ne push PAS vers Docker Hub.
Les images restent EN LOCAL sur ta machine.

### Ce qui change dans les Jenkinsfiles :

AVANT (avec Docker Hub) :
```groovy
environment {
    IMAGE_NAME = 'ton-username/projet01'
    DOCKERHUB_CREDENTIALS = credentials('dockerhub-creds')
}
// ...
sh 'docker push ${IMAGE_NAME}:${BUILD_NUMBER}'
```

APRÈS (hors ligne, images locales) :
```groovy
environment {
    IMAGE_NAME = 'projet01'
}
// ...
// PAS de docker push — l'image reste en local
// PAS de docker login — pas besoin
```

Tu peux simplement SUPPRIMER les stages "Push to Docker Hub" de tes Jenkinsfiles.
L'image est buildée et testée localement, c'est suffisant pour apprendre.

---

## RÉSUMÉ — Ce qui change sans internet

| Avec internet | Hors ligne |
|---|---|
| GitHub | GitLab local (http://localhost) |
| Docker Hub | Images locales (pas de push) |
| `githubPush()` | `gitlab(triggerOnPush: true)` |
| `http://github.com/...` | `http://gitlab/root/...` |
| Credential `dockerhub-creds` | Pas nécessaire |
| Stage "Push to Docker Hub" | SUPPRIMER ce stage |
| AWS EC2 | Pas pour l'instant |

---

## DÉPANNAGE

### GitLab met longtemps à démarrer
Normal. 3-5 minutes la première fois. Vérifier :
```bash
docker logs -f gitlab
# Attendre "gitlab Reconfigured!"
```

### Jenkins ne trouve pas GitLab
- URL dans Jenkins doit être `http://gitlab/root/...` (PAS localhost)
- Vérifier que les 2 conteneurs tournent : `docker ps`

### "Connection refused" sur le webhook
- Vérifier que "Allow local network requests" est activé dans GitLab Admin
- L'URL du webhook doit être `http://jenkins:8080/project/NOM` (pas localhost)

### Jenkins ne peut pas exécuter docker
- Vérifier que `/var/run/docker.sock` est monté (c'est dans le docker-compose)
- Dans le conteneur Jenkins : `docker ps` doit fonctionner

### Pas assez de RAM
GitLab consomme ~3 Go. Jenkins ~1 Go. Il te faut minimum 6 Go de RAM libre.
```bash
# Voir la consommation :
docker stats
```

---

## COMMANDES UTILES

```bash
# Tout lancer
cd ~/devops-exercices && docker-compose up -d

# Tout arrêter (données conservées)
docker-compose down

# Tout arrêter ET supprimer les données (reset complet)
docker-compose down --volumes

# Voir les logs
docker-compose logs -f gitlab
docker-compose logs -f jenkins

# État des conteneurs
docker ps
docker stats
```

---

## PLUGINS JENKINS HORS LIGNE

Si tu n'avais pas internet au moment de l'install Jenkins :

### Télécharger les plugins .hpi (sur une machine avec internet) :
Aller sur https://plugins.jenkins.io et télécharger les .hpi :
- git.hpi
- workflow-aggregator.hpi (= Pipeline)
- docker-workflow.hpi (= Docker Pipeline)
- gitlab-plugin.hpi
- ssh-agent.hpi
- credentials-binding.hpi

### Les installer dans Jenkins :
1. Copier les .hpi sur ta machine
2. Jenkins → Manage Jenkins → Plugins → Advanced settings
3. "Deploy Plugin" → Upload le fichier .hpi
4. Redémarrer Jenkins : `docker restart jenkins`

OU directement :
```bash
# Copier le .hpi dans le conteneur
docker cp git.hpi jenkins:/var/jenkins_home/plugins/
docker restart jenkins
```

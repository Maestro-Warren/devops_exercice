#!/bin/bash
cd ~/devops-exercices
git add .
git commit -m "${1:-update}"
git push

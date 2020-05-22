
scp !(node_modules/*) -r -P 22012 root@mantledev100.local:~/ ~/code/llama/
scp -r -P 22012 root@mantledev100.local:~/ ~/code/llama/
scp -r -P 22012 root@mantledev100.local:~/ ~/code/llama/

rsync -av -e ssh --exclude='node_modules' dave@192.168.4.36:~/code/llama ~/

rsync -av -e ssh --port 22012 ~/code/llama/ root@mantledev100.local:~/llama

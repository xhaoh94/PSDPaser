@echo off
title PSD Parser
echo Starting PSD Parser...

::这里修改为你当前的目录
cd /d C:\Project\PSDPaser

echo Starting server...

npx serve -s dist -l 5173

::use python 可以打开cmd 输入where python 查看你的python安装目录
::C:\Users\xhaoh\AppData\Local\Programs\Python\Python314\python.exe -m http.server 5173 --directory dist
::pause >null
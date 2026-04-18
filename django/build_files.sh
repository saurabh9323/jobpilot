cat > build_files.sh << 'EOF'
pip install -r requirements-vercel.txt
python manage.py collectstatic --noinput
EOF
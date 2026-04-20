pip install -r requirements.txt
mkdir -p staticfiles
python manage.py collectstatic --noinput --clear
python manage.py migrate
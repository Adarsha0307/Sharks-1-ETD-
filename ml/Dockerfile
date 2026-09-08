FROM python:3.12.10-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY ml/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY ml/app ./app
RUN useradd --system --uid 10001 --create-home etdml
USER 10001
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

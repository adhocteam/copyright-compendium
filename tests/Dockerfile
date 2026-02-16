FROM python:3.11-slim
WORKDIR /workspace
ENV PYTHONUNBUFFERED=1
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
ENTRYPOINT ["python", "-m", "tests.run_qa"]

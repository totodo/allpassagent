# Dify API Integration Guide

## Introduction

This guide explains how to integrate the RAG Orchestrator with Dify as a custom tool. By exposing the RAG Orchestrator's functionality through an OpenAPI specification, you can easily import it into Dify and use it in your AI applications.

## Prerequisites

- A running instance of the RAG Orchestrator API.
- A Dify account.

## Steps

1. **Expose the OpenAPI Specification**

The RAG Orchestrator API exposes an OpenAPI 3.1.0 specification at the `/openapi.json` endpoint. This specification describes the available API endpoints, their parameters, and their responses.

2. **Import the API into Dify**

   - In your Dify workspace, navigate to the "Tools" section.
   - Click on the "Add Tool" button.
   - Select the "Import from OpenAPI" option.
   - Enter the URL of your RAG Orchestrator API's OpenAPI specification (e.g., `http://localhost:8000/openapi.json`).
   - Dify will automatically parse the specification and create a new tool for the RAG Orchestrator.

3. **Use the RAG Orchestrator in your Dify Applications**

   - Once the tool has been imported, you can use it in your Dify applications.
   - In the application editor, add a new node and select the RAG Orchestrator tool.
   - You can then call the `upload` and `search` methods of the RAG Orchestrator to process documents and retrieve information.

## Example Usage

### Uploading a Document

To upload a document, you can use the `upload` method of the RAG Orchestrator tool. This method takes the path to the document as input and returns a confirmation message.

### Searching for Information

To search for information, you can use the `search` method of the RAG Orchestrator tool. This method takes a query and the desired number of results (top_k) as input and returns a list of the most relevant text chunks.
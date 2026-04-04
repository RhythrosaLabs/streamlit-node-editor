from setuptools import setup, find_packages

setup(
    name="streamlit-node-editor",
    version="0.1.0",
    author="Your Name",
    author_email="you@example.com",
    description="A ComfyUI/Blueprints-style node graph editor for Streamlit — typed ports, drag-to-connect, inline params",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/streamlit-node-editor",
    packages=find_packages(),
    include_package_data=True,
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Framework :: Streamlit",
    ],
    python_requires=">=3.8",
    install_requires=["streamlit>=1.28.0"],
)

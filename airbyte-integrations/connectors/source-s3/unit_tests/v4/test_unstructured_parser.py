#
# Copyright (c) 2023 Airbyte, Inc., all rights reserved.
#

import asyncio
from unittest.mock import MagicMock, mock_open, patch

import pytest
from airbyte_cdk.sources.file_based.exceptions import RecordParseError
from source_s3.v4.unstructured_parser import UnstructuredParser
from unstructured.documents.elements import ElementMetadata, Formula, ListItem, Text, Title
from unstructured.file_utils.filetype import FileType

FILE_URI = "path/to/file.xyz"


@pytest.mark.parametrize(
    "filetype, raises",
    [
        pytest.param(
            FileType.MD,
            False,
            id="markdown file",
        ),
        pytest.param(
            FileType.CSV,
            True,
            id="wrong file format",
        ),
        pytest.param(
            FileType.PDF,
            False,
            id="pdf file",
        ),
        pytest.param(
            FileType.DOCX,
            False,
            id="docx file",
        ),
    ],
)
@patch("unstructured.file_utils.filetype.detect_filetype")
def test_infer_schema(mock_detect_filetype, filetype, raises):
    stream_reader = MagicMock()
    mock_open(stream_reader.open_file)
    fake_file = MagicMock()
    fake_file.uri = FILE_URI
    logger = MagicMock()
    mock_detect_filetype.return_value = filetype
    if raises:
        with pytest.raises(RecordParseError):
            asyncio.run(UnstructuredParser().infer_schema(MagicMock(), fake_file, stream_reader, logger))
    else:
        schema = asyncio.run(UnstructuredParser().infer_schema(MagicMock(), MagicMock(), MagicMock(), MagicMock()))
        assert schema == {
            "content": {"type": "string"},
            "id": {"type": "string"},
        }


@pytest.mark.parametrize(
    "filetype, parse_result, raises, expected_records",
    [
        pytest.param(
            FileType.MD,
            "test",
            False,
            [
                {
                    "content": "test",
                    "id": FILE_URI,
                }
            ],
            id="markdown file",
        ),
        pytest.param(
            FileType.CSV,
            "test",
            True,
            None,
            id="wrong file format",
        ),
        pytest.param(
            FileType.PDF,
            [
                Title("heading"),
                Text("This is the text"),
                ListItem("This is a list item"),
                Formula("This is a formula"),
            ],
            False,
            [
                {
                    "content": "# heading\n\nThis is the text\n\n- This is a list item\n\n```\nThis is a formula\n```",
                    "id": FILE_URI,
                }
            ],
            id="pdf file",
        ),
        pytest.param(
            FileType.PDF,
            [
                Title("first level heading", metadata=ElementMetadata(category_depth=1)),
                Title("second level heading", metadata=ElementMetadata(category_depth=2)),
            ],
            False,
            [
                {
                    "content": "# first level heading\n\n## second level heading",
                    "id": FILE_URI,
                }
            ],
            id="multi-level headings",
        ),
        pytest.param(
            FileType.DOCX,
            [
                Title("heading"),
                Text("This is the text"),
                ListItem("This is a list item"),
                Formula("This is a formula"),
            ],
            False,
            [
                {
                    "content": "# heading\n\nThis is the text\n\n- This is a list item\n\n```\nThis is a formula\n```",
                    "id": FILE_URI,
                }
            ],
            id="docx file",
        ),
    ],
)
@patch("unstructured.partition.auto.partition")
@patch("unstructured.partition.md.optional_decode")
@patch("unstructured.file_utils.filetype.detect_filetype")
def test_parse_records(mock_detect_filetype, mock_optional_decode, mock_partition, filetype, parse_result, raises, expected_records):
    stream_reader = MagicMock()
    mock_open(stream_reader.open_file, read_data=str(parse_result))
    fake_file = MagicMock()
    fake_file.uri = FILE_URI
    logger = MagicMock()
    mock_detect_filetype.return_value = filetype
    mock_partition.return_value = parse_result
    mock_optional_decode.side_effect = lambda x: x
    if raises:
        with pytest.raises(RecordParseError):
            list(UnstructuredParser().parse_records(MagicMock(), fake_file, stream_reader, logger, MagicMock()))
    else:
        assert list(UnstructuredParser().parse_records(MagicMock(), fake_file, stream_reader, logger, MagicMock())) == expected_records
